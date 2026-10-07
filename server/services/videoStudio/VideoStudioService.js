'use strict';
/**
 * LMSGEN Video Studio - Node orchestration.
 *
 * Pipeline (mirrors the VideoForge desktop flow, adapted for the web):
 *   1. generateScript: ChatGPT writes a blueprint (strict JSON schema) - cheap, reviewed by the user.
 *   2. buildVideo:    TTS voiceover per scene + hero images per scene (AI or user-uploaded),
 *                     then the Python renderer (server/video-studio/render_cli.py) paints
 *                     1920x1080 frames, assembles and loudness-normalizes the MP4.
 *                     The final video is uploaded to ObjectStorage; the browser downloads
 *                     it from there (Render disks are ephemeral).
 *
 * All OpenAI spend goes through OpenAiClient (budget gates + metering live there).
 * Nothing after script approval costs money until the user approves the script.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const OpenAiClient = require('../openai/OpenAiClient');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const logger = require('../../utils/logger');

const LAYOUTS = ['linkedin', 'innvikta', 'course', 'kinetic', 'cinematic'];

const LAYOUT_BRIEFS = {
    linkedin: 'title, bullets, checklist, callout, closing scenes; light professional learning format',
    innvikta: 'title, bullets, callout, checklist, closing scenes; bold security-awareness format',
    course: 'title, bullets, callout, checklist, closing scenes; clean compliance-course format',
    kinetic: 'statement scenes only - one giant animated typographic statement per scene',
    cinematic: 'title, statement, closing scenes - full-bleed imagery with lower-third text'
};

const IMAGE_ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const USD_TO_INR = 95;

/** Per-video AI budget. Default ₹10 comfortably covers a typical video (~₹5). */
function videoBudget() {
    return {
        budgetInr: clampInt(process.env.OPENAI_VIDEO_BUDGET_INR, 10, 1, 100),
        usdToInr: USD_TO_INR
    };
}

/**
 * Cost estimate for a build: TTS characters + AI images.
 * User-uploaded scene images cost nothing. Mirrors the client-side estimate.
 */
function estimateBuildCostUsd(blueprint, imageKeys = {}) {
    const scenes = blueprint.scenes || [];
    let ttsChars = 0;
    let aiImages = 0;
    for (const [i, scene] of scenes.entries()) {
        ttsChars += clean(scene.narration).length;
        if (!(imageKeys[i] || imageKeys[String(i)])) aiImages += 1;
    }
    const ttsCost = (ttsChars / 1e6) * OpenAiClient.TTS_USD_PER_MILLION_CHARS;
    const imageCost = aiImages * OpenAiClient.LOW_IMAGE_ESTIMATE_USD;
    return {
        ttsChars, aiImages, ttsCost, imageCost,
        total: ttsCost + imageCost,
        currency: 'USD'
    };
}

/** Reject the build before anything is spent if it exceeds the per-video budget. */
function assertVideoBudget(blueprint, imageKeys = {}) {
    const { budgetInr, usdToInr } = videoBudget();
    const estimate = estimateBuildCostUsd(blueprint, imageKeys);
    const budgetUsd = budgetInr / usdToInr;
    if (estimate.total > budgetUsd) {
        const error = new Error(
            `This video would cost ~$${estimate.total.toFixed(2)} (about Rs.${Math.round(estimate.total * usdToInr)}), ` +
            `over the Rs.${budgetInr} per-video budget. Upload your own scene images or shorten the narration.`
        );
        error.code = 'VIDEO_OVER_BUDGET';
        error.status = 402;
        throw error;
    }
    return estimate;
}

function clean(value) {
    return String(value || '').trim();
}

function clampInt(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function sceneCountFor(seconds) {
    return clampInt(Math.round((Number(seconds) || 60) / 12), 5, 3, 8);
}

/**
 * Strict JSON schema for the blueprint. Mirrors VideoForge's blueprint contract.
 * image_file is intentionally absent here: web uploads arrive as storage keys
 * (imageKeys) at build time, never inside the AI-written script.
 */
function blueprintSchema(n) {
    const scene = {
        type: 'object',
        properties: {
            kind: { type: 'string' },
            headline: { type: 'string' },
            highlight: { type: 'string' },
            sub: { type: 'string' },
            bullets: { type: 'array', items: { type: 'string' } },
            narration: { type: 'string' },
            image_prompt: { type: 'string' }
        },
        required: ['kind', 'headline', 'highlight', 'sub', 'bullets', 'narration', 'image_prompt'],
        additionalProperties: false
    };
    return {
        type: 'object',
        properties: {
            title: { type: 'string' },
            scenes: { type: 'array', items: scene, minItems: n, maxItems: n }
        },
        required: ['title', 'scenes'],
        additionalProperties: false
    };
}

function validateBlueprint(bp, n, layout) {
    if (!bp || typeof bp !== 'object') throw bad('Blueprint must be an object.');
    if (!Array.isArray(bp.scenes) || bp.scenes.length === 0) throw bad('Blueprint needs at least one scene.');
    if (bp.scenes.length > 10) throw bad('Blueprint supports at most 10 scenes.');
    const kinds = new Set(bp.scenes.map((s) => s.kind));
    if (layout === 'kinetic' && ![...kinds].every((k) => ['statement', 'title', 'closing'].includes(k))) {
        throw bad('The kinetic layout only supports statement/title/closing scenes.');
    }
    for (const [i, s] of bp.scenes.entries()) {
        if (!s || typeof s !== 'object') throw bad(`Scene ${i + 1} is malformed.`);
        for (const f of ['kind', 'headline', 'narration']) {
            if (!clean(s[f])) throw bad(`Scene ${i + 1} is missing "${f}".`);
        }
        if (!Array.isArray(s.bullets)) s.bullets = [];
    }
    return true;
    function bad(message) {
        const error = new Error(message);
        error.code = 'VIDEO_BLUEPRINT_INVALID';
        error.status = 422;
        return error;
    }
}

async function generateScript({ topic, description, layout, seconds = 60 }) {
    const t = clean(topic);
    const d = clean(description);
    if (!t) {
        const error = new Error('A topic is required.');
        error.code = 'VIDEO_TOPIC_REQUIRED';
        error.status = 422;
        throw error;
    }
    if (!LAYOUTS.includes(layout)) {
        const error = new Error(`Unknown layout. Choose one of: ${LAYOUTS.join(', ')}.`);
        error.code = 'VIDEO_LAYOUT_UNKNOWN';
        error.status = 422;
        throw error;
    }
    const n = sceneCountFor(seconds);
    const wps = Math.max(18, Math.round((Number(seconds) || 60) / n / 60 * 145));
    const instructions = [
        'You are a video scriptwriter for LMSGEN Video Studio.',
        'Write the on-screen copy AND the voiceover narration for a short explainer video.',
        `Return EXACTLY ${n} scenes. Scene kinds suited to this layout: ${LAYOUT_BRIEFS[layout]}.`,
        `Narration per scene: about ${wps} words (spoken pace).`,
        'On-screen text (headline/sub/bullets) is SHORT; narration carries the detail.',
        'highlight = ONE keyword from the headline to emphasize (may be "").',
        'image_prompt: vivid, specific, no text in image, no people faces unless asked.',
        'NEVER invent statistics, dates, fines, or study results. If the description gives a figure, use it;',
        'otherwise write around it ("hefty penalties", not "Rs.X").',
        'No emojis anywhere. Plain language, no em/en dashes in on-screen text.'
    ].join('\n');
    const response = await OpenAiClient.createStructuredResponse({
        instructions,
        input: JSON.stringify({ topic: t, description: d, layout }),
        schema: blueprintSchema(n),
        schemaName: 'video_blueprint',
        maxOutputTokens: 6000
    });
    let bp;
    try {
        bp = JSON.parse(response.text);
    } catch (_) {
        const error = new Error('The script came back in an unreadable format. Please regenerate.');
        error.code = 'VIDEO_SCRIPT_PARSE';
        throw error;
    }
    validateBlueprint(bp, n, layout);
    return {
        blueprint: bp,
        layout,
        usage: response.usage || {},
        estimatedCostUsd: response.estimatedCostUsd || 0
    };
}

/** Download a user-uploaded scene image from ObjectStorage into the work dir. */
async function fetchCustomImage(storageKey, destPath) {
    const storage = getObjectStorage();
    const body = await storage.getObjectBuffer(storageKey);
    if (!body || body.length > MAX_IMAGE_BYTES) {
        throw Object.assign(new Error('Custom image is missing or too large.'), { code: 'VIDEO_IMAGE_FETCH' });
    }
    fs.writeFileSync(destPath, body);
    return destPath;
}

/** AI-generate a hero image for a scene. Returns the local file path. */
async function generateHeroImage(scene, destPath) {
    const prompt = `${clean(scene.image_prompt) || 'abstract professional background'}. ` +
        '3D render style, soft studio lighting, no text, no words, no letters, no watermark.';
    const result = await OpenAiClient.generateImage({ prompt: prompt.slice(0, 900), size: '1024x1024' });
    fs.writeFileSync(destPath, result.body);
    return { path: destPath, estimatedCostUsd: result.estimatedCostUsd || 0 };
}

function ttsText(narration) {
    // TTS reads better with gentle sentence breaks; keep it simple and safe.
    return clean(narration).replace(/\s+/g, ' ');
}

async function synthesizeSceneVoice(narration, destPath, voice) {
    const result = await OpenAiClient.synthesizeSpeech({ input: ttsText(narration), voice });
    fs.writeFileSync(destPath, result.body);
    return { path: destPath, estimatedCostUsd: result.estimatedCostUsd || 0 };
}

function runRenderer(manifestPath, onProgress) {
    return new Promise((resolve, reject) => {
        const script = path.join(__dirname, '..', '..', 'video-studio', 'render_cli.py');
        const python = process.env.VIDEO_STUDIO_PYTHON || 'python3';
        const child = spawn(python, [script, manifestPath], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        let result = null;
        child.stdout.on('data', (chunk) => {
            for (const line of String(chunk).split('\n')) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('{')) continue;
                try {
                    const msg = JSON.parse(trimmed);
                    if (msg.type === 'progress' && onProgress) {
                        onProgress({ percent: msg.percent, stage: msg.stage, detail: msg.detail });
                    } else if (msg.type === 'warning') {
                        logger.warn('video_render_warning', { module: 'video-studio', detail: msg.detail });
                    } else if (msg.type === 'result') {
                        result = msg;
                    }
                } catch (_) { /* ignore non-JSON lines */ }
            }
        });
        child.stderr.on('data', (chunk) => { stderr += String(chunk); });
        child.on('error', (error) => reject(Object.assign(
            new Error(`Video renderer failed to start: ${error.message}`), { code: 'VIDEO_RENDER_SPAWN' })));
        child.on('close', (code) => {
            if (code === 0 && result && result.video) return resolve(result);
            const error = new Error(`Video rendering failed (exit ${code}). ${stderr.slice(-500)}`.trim());
            error.code = 'VIDEO_RENDER_FAILED';
            reject(error);
        });
    });
}

/**
 * Full build: voice + images + render + upload.
 * blueprint: user-approved blueprint object.
 * imageKeys: { sceneIndex: storageKey } for user-uploaded scene art.
 * onProgress({percent, stage, detail}) - forwarded to the job's progress channel.
 */
async function buildVideo({ blueprint, imageKeys = {}, userId, voice, onProgress = () => {} }) {
    validateBlueprint(blueprint, blueprint.scenes.length, blueprint.layout || 'linkedin');
    const layout = LAYOUTS.includes(blueprint.layout) ? blueprint.layout : 'linkedin';
    const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-'));
    const audioDir = path.join(workRoot, 'audio');
    const imgDir = path.join(workRoot, 'heroes');
    fs.mkdirSync(audioDir, { recursive: true });
    fs.mkdirSync(imgDir, { recursive: true });

    const ttsVoice = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voice) ? voice : 'onyx';
    const scenes = blueprint.scenes;
    const manifestScenes = [];
    let spendUsd = 0;

    for (const [i, scene] of scenes.entries()) {
        onProgress({ percent: Math.round(2 + (i / scenes.length) * 30), stage: 'voice', detail: `scene ${i + 1}/${scenes.length}` });
        // 1. voiceover
        const audioPath = path.join(audioDir, `scene_${String(i).padStart(2, '0')}.mp3`);
        const v = await synthesizeSceneVoice(scene.narration, audioPath, ttsVoice);
        spendUsd += v.estimatedCostUsd;
        // 2. hero image: user upload wins, then AI generation
        const imgPath = path.join(imgDir, `scene_${String(i).padStart(2, '0')}.png`);
        const customKey = imageKeys[i] || imageKeys[String(i)];
        if (customKey) {
            await fetchCustomImage(String(customKey), imgPath);
        } else {
            const g = await generateHeroImage(scene, imgPath);
            spendUsd += g.estimatedCostUsd;
        }
        manifestScenes.push({ ...scene, audio: audioPath, image: imgPath });
    }

    // 3. render
    const manifestPath = path.join(workRoot, 'manifest.json');
    const outPath = path.join(workRoot, 'video.mp4');
    fs.writeFileSync(manifestPath, JSON.stringify({
        layout,
        fps: 30,
        tail_seconds: 0.8,
        logo: null,
        scenes: manifestScenes,
        workdir: path.join(workRoot, 'work'),
        out: outPath
    }));
    const rendered = await runRenderer(manifestPath, (p) => onProgress({
        percent: Math.round(35 + (p.percent / 100) * 55),
        stage: p.stage,
        detail: p.detail
    }));

    // 4. upload final MP4 to durable storage
    onProgress({ percent: 94, stage: 'upload', detail: 'saving finished video' });
    const storage = getObjectStorage();
    const key = `video-studio/${String(userId || 'anon')}/${crypto.randomUUID()}/video.mp4`;
    const body = fs.readFileSync(rendered.video);
    await storage.putObject({ key, body, contentType: 'video/mp4' });

    // best-effort temp cleanup
    fs.rm(workRoot, { recursive: true, force: true }, () => {});

    return {
        storageKey: key,
        seconds: rendered.seconds,
        scenes: scenes.length,
        layout,
        estimatedCostUsd: spendUsd
    };
}

module.exports = {
    LAYOUTS,
    IMAGE_ACCEPT,
    MAX_IMAGE_BYTES,
    USD_TO_INR,
    generateScript,
    validateBlueprint,
    buildVideo,
    sceneCountFor,
    videoBudget,
    estimateBuildCostUsd,
    assertVideoBudget
};
