'use strict';

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const JSZip = require('jszip');

const MAX_SOURCE_CHARS = 120000;

function decodeXml(value) {
    return String(value || '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeText(value, maxChars = MAX_SOURCE_CHARS) {
    return String(value || '')
        .replace(/\u0000/g, '')
        .replace(/\r/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim()
        .slice(0, maxChars);
}

async function extractPptxText(base64Data) {
    const zip = await JSZip.loadAsync(base64Data, { base64: true });
    const names = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1] || 0) - Number(b.match(/slide(\d+)/i)?.[1] || 0));
    const chunks = [];
    for (const name of names) {
        const xml = await zip.file(name).async('string');
        const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
            .map((match) => decodeXml(match[1]))
            .filter(Boolean)
            .join(' ');
        if (text) chunks.push(text);
    }
    return normalizeText(chunks.join('\n\n'));
}

async function extractDocxText(base64Data) {
    const zip = await JSZip.loadAsync(base64Data, { base64: true });
    const document = zip.file('word/document.xml');
    if (!document) return '';
    const xml = await document.async('string');
    return normalizeText([...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXml(match[1]))
        .filter(Boolean)
        .join(' '));
}

function run(command, args, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            const error = new Error(`${command} timed out.`);
            error.code = 'DOCUMENT_TEXT_TIMEOUT';
            reject(error);
        }, timeoutMs);
        timer.unref?.();
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) return resolve();
            const error = new Error(stderr.trim() || `${command} exited with code ${code}.`);
            error.code = 'DOCUMENT_TEXT_FAILED';
            reject(error);
        });
    });
}

async function extractPdfText(base64Data) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lmsgen-openai-'));
    const inputPath = path.join(tempDir, 'source.pdf');
    const outputPath = path.join(tempDir, 'source.txt');
    try {
        await fs.writeFile(inputPath, Buffer.from(base64Data, 'base64'));
        await run(process.env.PDFTOTEXT_CMD || 'pdftotext', ['-layout', '-nopgbrk', inputPath, outputPath]);
        return normalizeText(await fs.readFile(outputPath, 'utf8'));
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
}

async function extractDocumentText({ fileBase64, mimeType, fileName = '' }) {
    const raw = String(fileBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!raw) return '';
    const mime = String(mimeType || '').toLowerCase();
    const name = String(fileName || '').toLowerCase();
    if (mime.includes('presentationml.presentation') || mime.includes('powerpoint') || name.endsWith('.pptx')) {
        return extractPptxText(raw);
    }
    if (mime.includes('wordprocessingml.document') || name.endsWith('.docx')) {
        return extractDocxText(raw);
    }
    if (mime.includes('pdf') || name.endsWith('.pdf')) {
        return extractPdfText(raw);
    }
    if (mime.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
        return normalizeText(Buffer.from(raw, 'base64').toString('utf8'));
    }
    return '';
}

module.exports = {
    MAX_SOURCE_CHARS,
    decodeXml,
    normalizeText,
    extractPptxText,
    extractDocxText,
    extractPdfText,
    extractDocumentText
};
