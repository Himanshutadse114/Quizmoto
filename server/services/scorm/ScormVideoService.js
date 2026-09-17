const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
    ScormCampaign,
    ScormCampaignLearner,
    ScormVideo,
    ScormCampaignVideo,
    ScormVideoProgress
} = require('../../models/scorm');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
let schemaPromise = null;

function fail(message, code, status = 400) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function ensureVideoSchema() {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            await ScormVideo.sync();
            await ScormCampaignVideo.sync();
            await ScormVideoProgress.sync();
        })().catch((error) => {
            schemaPromise = null;
            throw error;
        });
    }
    await schemaPromise;
}

function serializeVideo(video) {
    return {
        id: video.id,
        title: video.title,
        description: video.description || null,
        mimeType: video.mimeType,
        byteSize: Number(video.byteSize || 0),
        durationSeconds: video.durationSeconds == null ? null : Number(video.durationSeconds),
        status: video.status,
        createdAt: video.createdAt,
        updatedAt: video.updatedAt
    };
}

async function listVideos({ workspaceId, hostId }) {
    await ensureVideoSchema();
    const videos = await ScormVideo.findAll({
        where: { workspaceId, hostId, status: { [Op.ne]: 'deleted' } },
        order: [['createdAt', 'DESC']]
    });
    return videos.map(serializeVideo);
}

function normalizeVideoSelections(value) {
    const seen = new Set();
    return (Array.isArray(value) ? value : []).map((raw, index) => ({
        videoId: String(typeof raw === 'string' ? raw : raw?.videoId || '').trim(),
        required: typeof raw === 'object' ? raw.required !== false : true,
        position: Number.isFinite(Number(raw?.position)) ? Number(raw.position) : index
    })).filter((item) => item.videoId && !seen.has(item.videoId) && seen.add(item.videoId));
}

async function saveCampaignVideos({ campaign, selections }) {
    await ensureVideoSchema();
    const normalized = normalizeVideoSelections(selections);
    if (normalized.length) {
        const available = await ScormVideo.findAll({
            where: {
                id: { [Op.in]: normalized.map((item) => item.videoId) },
                workspaceId: campaign.workspaceId,
                hostId: campaign.hostId,
                status: 'ready'
            }
        });
        if (available.length !== normalized.length) {
            throw fail('One or more selected videos are not available in this workspace.', 'SCORM_VIDEO_SELECTION_INVALID', 400);
        }
    }
    await ScormCampaignVideo.destroy({ where: { campaignId: campaign.id } });
    if (!normalized.length) return [];
    return ScormCampaignVideo.bulkCreate(normalized.map((item) => ({ campaignId: campaign.id, ...item })));
}

async function campaignVideos(campaignId) {
    await ensureVideoSchema();
    const links = await ScormCampaignVideo.findAll({
        where: { campaignId },
        include: [{ model: ScormVideo, as: 'video', required: false }],
        order: [['position', 'ASC'], ['createdAt', 'ASC']]
    });
    return links.map((link) => ({
        id: link.id,
        videoId: link.videoId,
        required: link.required !== false,
        position: Number(link.position || 0),
        ...(link.video ? serializeVideo(link.video) : { title: 'Video', status: 'missing' })
    }));
}

function normalizeRanges(value, duration) {
    const max = Math.max(0, Number(duration || 0));
    const ranges = (Array.isArray(value) ? value : [])
        .map((range) => [Math.max(0, Number(range?.[0] || 0)), Math.max(0, Number(range?.[1] || 0))])
        .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
        .map(([start, end]) => [Math.min(start, max || start), Math.min(end, max || end)])
        .filter(([start, end]) => end > start)
        .sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1] + 0.75) last[1] = Math.max(last[1], range[1]);
        else merged.push(range);
    }
    return merged.slice(-500);
}

function rangeSeconds(ranges) {
    return ranges.reduce((sum, range) => sum + Math.max(0, range[1] - range[0]), 0);
}

function plausibleWatchSegment({ elapsed, from, to, playbackRate = 1 }) {
    const safeElapsed = Math.max(0, Math.min(20, Number(elapsed || 0)));
    const safeFrom = Math.max(0, Number(from || 0));
    const safeTo = Math.max(0, Number(to || 0));
    const safeRate = Math.max(0.25, Math.min(4, Number(playbackRate || 1)));
    const forward = safeTo - safeFrom;
    return safeElapsed > 0 && forward > 0 && forward <= Math.min(22, safeElapsed * safeRate * 1.35 + 2.5);
}

function progressPayload(progress, video) {
    const duration = Math.max(0, Number(progress.durationSeconds || video.durationSeconds || 0));
    const watched = Math.min(duration || Infinity, Math.max(0, Number(progress.watchedSeconds || 0)));
    return {
        status: progress.status,
        progressPercent: duration ? Math.min(100, Math.round((watched / duration) * 100)) : 0,
        watchedSeconds: Math.round(watched * 10) / 10,
        activeSeconds: Math.round(Number(progress.activeSeconds || 0) * 10) / 10,
        lastPositionSeconds: Number(progress.lastPositionSeconds || 0),
        durationSeconds: duration || null,
        playCount: Number(progress.playCount || 0),
        seekCount: Number(progress.seekCount || 0),
        completedAt: progress.completedAt || null,
        lastActivityAt: progress.lastActivityAt || null
    };
}

async function assertCampaignVideoAccess(context, videoId) {
    await ensureVideoSchema();
    const campaign = await ScormCampaign.findOne({ where: { id: context.campaignId, status: 'active' } });
    if (!campaign || Number(campaign.hostId) !== Number(context.hostId) || (context.workspaceId && String(campaign.workspaceId) !== String(context.workspaceId))) {
        throw fail('Campaign access is no longer active.', 'SCORM_CAMPAIGN_NOT_ACTIVE', 403);
    }
    const learner = await ScormCampaignLearner.findOne({
        where: { campaignId: campaign.id, email: normalizeEmail(context.email) }
    });
    if (!learner) throw fail('You are no longer assigned to this campaign.', 'SCORM_CAMPAIGN_LEARNER_NOT_INCLUDED', 403);
    const link = await ScormCampaignVideo.findOne({
        where: { campaignId: campaign.id, videoId },
        include: [{ model: ScormVideo, as: 'video', required: true, where: { status: 'ready' } }]
    });
    if (!link) throw fail('Video assignment not found.', 'SCORM_VIDEO_ASSIGNMENT_NOT_FOUND', 404);
    return { campaign, learner, link, video: link.video };
}

async function getCampaignDashboardVideos(context) {
    await ensureVideoSchema();
    const links = await ScormCampaignVideo.findAll({
        where: { campaignId: context.campaignId },
        include: [{ model: ScormVideo, as: 'video', required: true, where: { status: 'ready' } }],
        order: [['position', 'ASC'], ['createdAt', 'ASC']]
    });
    const progressRows = await ScormVideoProgress.findAll({
        where: { campaignId: context.campaignId, learnerEmail: normalizeEmail(context.email) }
    });
    const progressByVideo = new Map(progressRows.map((row) => [String(row.videoId), row]));
    return links.map((link) => {
        const video = link.video;
        const progress = progressByVideo.get(String(video.id));
        return {
            videoId: video.id,
            title: video.title,
            description: video.description || null,
            durationSeconds: video.durationSeconds == null ? null : Number(video.durationSeconds),
            required: link.required !== false,
            ...(progress ? progressPayload(progress, video) : {
                status: 'not_started', progressPercent: 0, watchedSeconds: 0, activeSeconds: 0,
                lastPositionSeconds: 0, playCount: 0, seekCount: 0, completedAt: null, lastActivityAt: null
            })
        };
    });
}

async function launchCampaignVideo(context, videoId) {
    const { video } = await assertCampaignVideoAccess(context, videoId);
    const token = jwt.sign({
        typ: 'scorm_video_play',
        videoId: video.id,
        campaignId: context.campaignId,
        workspaceId: context.workspaceId,
        hostId: context.hostId,
        email: normalizeEmail(context.email),
        nonce: crypto.randomBytes(8).toString('hex')
    }, JWT_SECRET, { expiresIn: '2h' });
    return {
        video: serializeVideo(video),
        streamUrl: `/api/scorm-learner/video/${video.id}/stream?token=${encodeURIComponent(token)}`
    };
}

async function launchAdminVideo({ workspaceId, hostId }, videoId) {
    await ensureVideoSchema();
    const video = await ScormVideo.findOne({ where: { id: videoId, workspaceId, hostId, status: 'ready' } });
    if (!video) throw fail('Video not found.', 'SCORM_VIDEO_NOT_FOUND', 404);
    const token = jwt.sign({
        typ: 'scorm_video_admin',
        videoId: video.id,
        workspaceId,
        hostId,
        nonce: crypto.randomBytes(8).toString('hex')
    }, JWT_SECRET, { expiresIn: '1h' });
    return { video: serializeVideo(video), streamUrl: `/api/scorm-learner/video/${video.id}/stream?token=${encodeURIComponent(token)}` };
}

function verifyVideoToken(token, videoId) {
    try {
        const decoded = jwt.verify(String(token || ''), JWT_SECRET);
        if (!['scorm_video_play', 'scorm_video_admin'].includes(decoded.typ) || String(decoded.videoId) !== String(videoId)) throw new Error('invalid token');
        return decoded;
    } catch (_) {
        throw fail('Video session expired. Open the video again from your dashboard.', 'SCORM_VIDEO_TOKEN_INVALID', 401);
    }
}

async function authorizeVideoStream(token, videoId) {
    const decoded = verifyVideoToken(token, videoId);
    if (decoded.typ === 'scorm_video_admin') {
        const video = await ScormVideo.findOne({ where: { id: videoId, workspaceId: decoded.workspaceId, hostId: decoded.hostId, status: 'ready' } });
        if (!video) throw fail('Video is no longer available.', 'SCORM_VIDEO_NOT_FOUND', 404);
        return decoded;
    }
    await assertCampaignVideoAccess({
        campaignId: decoded.campaignId,
        workspaceId: decoded.workspaceId,
        hostId: decoded.hostId,
        email: decoded.email
    }, videoId);
    return decoded;
}

async function recordVideoProgress(context, videoId, input = {}) {
    const { video } = await assertCampaignVideoAccess(context, videoId);
    const now = new Date();
    const [progress] = await ScormVideoProgress.findOrCreate({
        where: { campaignId: context.campaignId, videoId, learnerEmail: normalizeEmail(context.email) },
        defaults: {
            workspaceId: context.workspaceId,
            campaignId: context.campaignId,
            videoId,
            learnerEmail: normalizeEmail(context.email),
            durationSeconds: Number(input.duration || video.durationSeconds || 0) || null
        }
    });
    const event = String(input.event || 'progress').toLowerCase();
    const position = Math.max(0, Number(input.position || 0));
    const duration = Math.max(0, Number(input.duration || progress.durationSeconds || video.durationSeconds || 0));
    if (duration && !video.durationSeconds) {
        video.durationSeconds = duration;
        await video.save();
    }
    progress.durationSeconds = duration || progress.durationSeconds || null;
    progress.lastPositionSeconds = duration ? Math.min(position, duration) : position;
    progress.lastActivityAt = now;
    progress.startedAt = progress.startedAt || now;
    if (event === 'play') progress.playCount += 1;
    if (event === 'seek') progress.seekCount += 1;

    const elapsed = Math.max(0, Math.min(20, Number(input.elapsed || 0)));
    const from = Math.max(0, Number(input.from || 0));
    const to = Math.max(0, Number(input.to ?? position));
    const forward = to - from;
    const plausible = plausibleWatchSegment({ elapsed, from, to, playbackRate: input.playbackRate });
    let ranges = normalizeRanges(progress.watchedRanges, duration);
    if (plausible) {
        ranges = normalizeRanges([...ranges, [from, to]], duration);
        progress.activeSeconds = Number(progress.activeSeconds || 0) + Math.min(elapsed, forward + 1.5);
    }
    progress.watchedRanges = ranges;
    progress.watchedSeconds = rangeSeconds(ranges);
    const completionRatio = duration ? progress.watchedSeconds / duration : 0;
    const completed = completionRatio >= 0.9 && (event === 'ended' || position >= duration * 0.95);
    progress.status = completed ? 'completed' : progress.watchedSeconds > 0 || event === 'play' ? 'in_progress' : 'assigned';
    if (completed) progress.completedAt = progress.completedAt || now;
    await progress.save();
    return progressPayload(progress, video);
}

async function listCampaignVideoAnalytics(campaignId) {
    await ensureVideoSchema();
    const [links, learners, progressRows] = await Promise.all([
        ScormCampaignVideo.findAll({ where: { campaignId }, include: [{ model: ScormVideo, as: 'video', required: true }] }),
        ScormCampaignLearner.findAll({ where: { campaignId } }),
        ScormVideoProgress.findAll({ where: { campaignId } })
    ]);
    const progressMap = new Map(progressRows.map((row) => [`${row.videoId}:${normalizeEmail(row.learnerEmail)}`, row]));
    const entries = [];
    for (const learner of learners) {
        for (const link of links) {
            const row = progressMap.get(`${link.videoId}:${normalizeEmail(learner.email)}`);
            const progress = row ? progressPayload(row, link.video) : { status: 'not_started', progressPercent: 0, watchedSeconds: 0, activeSeconds: 0, playCount: 0, seekCount: 0, lastActivityAt: null, completedAt: null };
            entries.push({ videoId: link.videoId, videoTitle: link.video.title, learnerEmail: learner.email, learnerName: learner.learnerName || learner.email, required: link.required !== false, ...progress });
        }
    }
    const videos = links.map((link) => {
        const rows = entries.filter((entry) => String(entry.videoId) === String(link.videoId));
        const completed = rows.filter((entry) => entry.status === 'completed').length;
        return {
            id: link.videoId,
            title: link.video.title,
            learnerCount: rows.length,
            completedCount: completed,
            completionRate: rows.length ? Math.round((rows.reduce((sum, row) => sum + Number(row.progressPercent || 0), 0) / rows.length) * 10) / 10 : 0,
            averageActiveSeconds: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.activeSeconds || 0), 0) / rows.length) : 0
        };
    });
    return { entries, videos };
}

module.exports = {
    ensureVideoSchema,
    serializeVideo,
    listVideos,
    saveCampaignVideos,
    campaignVideos,
    getCampaignDashboardVideos,
    launchCampaignVideo,
    launchAdminVideo,
    verifyVideoToken,
    authorizeVideoStream,
    recordVideoProgress,
    listCampaignVideoAnalytics,
    _test: { normalizeRanges, rangeSeconds, plausibleWatchSegment }
};
