const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const DEFAULT_SAMPLE = `A suspicious email may look completely genuine, but small warning signs can reveal the risk. Check the sender address carefully, avoid opening unexpected attachments, and never enter your password after following an unverified link. If a message creates urgency around payments, account verification, or confidential information, confirm the request through an independent channel. When in doubt, report the message to your information security team before taking action.`;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function previewDir() {
    const dir = process.env.TTS_PREVIEW_DIR || path.join(__dirname, '../../data/tts-preview');
    ensureDir(dir);
    return dir;
}

function pythonCandidates() {
    return [
        process.env.TTS_PYTHON_CMD,
        process.env.REPORT_PYTHON_CMD,
        '/usr/bin/python3',
        'python3',
        'python'
    ].filter(Boolean);
}

function scriptPath() {
    return path.join(__dirname, '../../utils/local_tts_preview.py');
}

function allowedVoice(id) {
    return id === 'melo_india' || id === 'kokoro_india';
}

function normalizeText(text) {
    const value = String(text || DEFAULT_SAMPLE).replace(/\s+/g, ' ').trim();
    if (!value) return DEFAULT_SAMPLE;
    return value.slice(0, 3000);
}

async function runPython(args, timeoutMs = 120000) {
    const script = scriptPath();
    if (!fs.existsSync(script)) {
        const err = new Error('Local TTS preview script is missing');
        err.code = 'TTS_SCRIPT_MISSING';
        throw err;
    }

    let lastErr = null;
    for (const cmd of pythonCandidates()) {
        try {
            return await execFileAsync(cmd, [script, ...args], {
                timeout: timeoutMs,
                windowsHide: true,
                killSignal: 'SIGTERM',
                env: {
                    ...process.env,
                    PYTHONUNBUFFERED: '1',
                    HF_HUB_OFFLINE: '1',
                    TRANSFORMERS_OFFLINE: '1'
                },
                maxBuffer: 4 * 1024 * 1024
            });
        } catch (err) {
            lastErr = err;
            if (err && err.code === 'ENOENT') continue;
            break;
        }
    }
    throw lastErr || new Error('No Python runtime available for TTS preview');
}

async function listVoices() {
    try {
        const { stdout } = await runPython(['--list'], 15000);
        const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
        return Array.isArray(parsed.voices) ? parsed.voices : [];
    } catch (err) {
        return [
            {
                id: 'melo_india',
                label: 'MeloTTS · Indian English',
                engine: 'MeloTTS',
                language: 'en-IN',
                offline: true,
                available: false,
                reason: `Voice detection failed: ${err.message}`
            },
            {
                id: 'kokoro_india',
                label: 'Kokoro · Indian English',
                engine: 'Kokoro',
                language: 'en-IN',
                offline: true,
                available: false,
                reason: `Voice detection failed: ${err.message}`
            }
        ];
    }
}

async function generatePreview({ voiceId, text, speed = 1.0 }) {
    if (!allowedVoice(voiceId)) {
        const err = new Error('Unsupported local TTS voice');
        err.code = 'TTS_VOICE_INVALID';
        throw err;
    }

    const narration = normalizeText(text);
    const rate = Math.max(0.75, Math.min(1.25, Number(speed) || 1.0));
    const hash = crypto
        .createHash('sha256')
        .update(`${voiceId}|${rate}|${narration}`)
        .digest('hex')
        .slice(0, 24);
    const dir = previewDir();
    const outputPath = path.join(dir, `${voiceId}_${hash}.wav`);

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 512) {
        return { outputPath, contentType: 'audio/wav', cached: true, text: narration };
    }

    const textPath = path.join(dir, `${voiceId}_${hash}.txt`);
    fs.writeFileSync(textPath, narration, 'utf8');
    try {
        await runPython([
            '--engine',
            voiceId,
            '--text-file',
            textPath,
            '--output',
            outputPath,
            '--speed',
            String(rate)
        ]);
    } catch (err) {
        const detail = err && err.stderr ? String(err.stderr).slice(-1800) : err.message;
        const wrapped = new Error(`Local ${voiceId} preview failed: ${detail}`);
        wrapped.code = 'TTS_PREVIEW_FAILED';
        throw wrapped;
    } finally {
        try { fs.unlinkSync(textPath); } catch (_) { /* ignore */ }
    }

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 512) {
        const err = new Error('Local TTS engine returned no playable audio');
        err.code = 'TTS_EMPTY_AUDIO';
        throw err;
    }

    return { outputPath, contentType: 'audio/wav', cached: false, text: narration };
}

module.exports = {
    DEFAULT_SAMPLE,
    listVoices,
    generatePreview
};
