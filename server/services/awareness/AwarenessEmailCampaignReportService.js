'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const EmailCampaigns = require('./AwarenessEmailCampaignService');

const execFileAsync = promisify(execFile);

function safeFilePart(value) {
    return String(value || 'Awareness_Campaign')
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'Awareness_Campaign';
}

function timestamp(value) {
    if (!value) return '';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function recipientStatus(recipient) {
    if (recipient.openedAt) return 'Tracked open';
    if (recipient.status === 'delivered') return 'Delivered';
    if (recipient.status === 'sent') return 'Provider queued';
    if (recipient.status === 'failed') return 'Failed';
    return 'Pending';
}

function buildAwarenessCampaignReport(campaign) {
    const recipients = Array.isArray(campaign?.recipients) ? campaign.recipients : [];
    const recipientTrackedOpens = recipients.filter((recipient) => recipient.openedAt).length;
    const trackedOpens = Number.isFinite(Number(campaign?.openedCount))
        ? Number(campaign.openedCount)
        : recipientTrackedOpens;
    return {
        schemaVersion: 'lmsgen-report-v2',
        reportType: 'awareness-email-campaign',
        generatedAt: new Date().toISOString(),
        tenant: { name: 'LMSGEN Awareness Emails' },
        title: `${campaign?.name || 'Awareness campaign'} — Campaign Report`,
        subtitle: `Delivery and recipient activity for ${campaign?.templateTitle || 'awareness email'}. Open tracking is an estimate because mail apps may block or proxy images.`,
        summary: [
            { label: 'Recipients', value: Number(campaign?.recipientCount || recipients.length) },
            { label: 'Provider queued', value: Number(campaign?.sentCount || 0) },
            { label: 'Delivered', value: Number(campaign?.deliveredCount || 0) },
            { label: 'Tracked opens', value: trackedOpens },
            { label: 'Failed', value: Number(campaign?.failedCount || 0) }
        ],
        columns: [
            { key: 'recipient', label: 'Recipient' },
            { key: 'email', label: 'Email' },
            { key: 'status', label: 'Status' },
            { key: 'opens', label: 'Tracked opens' },
            { key: 'firstOpen', label: 'First tracked open' },
            { key: 'lastOpen', label: 'Last tracked open' },
            { key: 'queuedAt', label: 'Queued at' },
            { key: 'error', label: 'Delivery error' }
        ],
        rows: recipients.map((recipient) => ({
            recipient: recipient.learnerName || 'Recipient',
            email: recipient.email || '',
            status: recipientStatus(recipient),
            opens: Number(recipient.openCount || 0),
            firstOpen: timestamp(recipient.openedAt),
            lastOpen: timestamp(recipient.lastOpenedAt),
            queuedAt: timestamp(recipient.sentAt),
            error: recipient.errorCode || ''
        })),
        emptyMessage: 'No recipients are available for this campaign.'
    };
}

function artifactDir() {
    const dir = process.env.REPORT_ARTIFACTS_DIR || path.join(__dirname, '../../data/artifacts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function generateCampaignReportFile({ campaignId, hostId, format }) {
    const kind = String(format || 'pdf').toLowerCase();
    if (!['pdf', 'excel'].includes(kind)) {
        const error = new Error('Choose PDF or Excel.');
        error.status = 400;
        error.code = 'AWARENESS_CAMPAIGN_REPORT_FORMAT_INVALID';
        throw error;
    }

    const campaign = await EmailCampaigns.getCampaign(campaignId, hostId, { includeRecipients: true });
    const report = buildAwarenessCampaignReport(campaign);
    const dir = artifactDir();
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const jsonPath = path.join(dir, `awareness-campaign-${stamp}.json`);
    const extension = kind === 'pdf' ? 'pdf' : 'xlsx';
    const outputPath = path.join(dir, `awareness-campaign-${stamp}.${extension}`);
    const scriptPath = path.join(__dirname, '../../utils/generate_lmsgen_report.py');
    const candidates = [process.env.REPORT_PYTHON_CMD, '/usr/bin/python3', 'python3', 'python'].filter(Boolean);
    let lastError = null;

    fs.writeFileSync(jsonPath, JSON.stringify(report), 'utf8');
    try {
        for (const python of candidates) {
            try {
                await execFileAsync(python, [scriptPath, jsonPath, outputPath, kind], {
                    timeout: Number(process.env.REPORT_GEN_TIMEOUT_MS) || 60000,
                    windowsHide: true,
                    maxBuffer: 8 * 1024 * 1024,
                    env: { ...process.env, PYTHONUNBUFFERED: '1' }
                });
                if (!fs.existsSync(outputPath)) throw new Error('Report generator did not create an output file.');
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
                if (error.code === 'ENOENT') continue;
                break;
            }
        }
        if (lastError || !fs.existsSync(outputPath)) {
            throw lastError || new Error('No Python runtime is available for report generation.');
        }
        return {
            outputPath,
            downloadName: `LMSGEN_Awareness_${safeFilePart(campaign.name)}.${extension}`
        };
    } finally {
        try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) {}
    }
}

module.exports = {
    buildAwarenessCampaignReport,
    generateCampaignReportFile
};
