const express = require('express');
const router = express.Router();
const Flipbook = require('../models/Flipbook');
const FlipbookReaderSession = require('../models/FlipbookReaderSession');
const FlipbookReaderContext = require('../models/FlipbookReaderContext');
const {
    startReaderSession,
    recordReaderEvents
} = require('../services/FlipbookAnalyticsService');
const {
    ensureFlipbookAssignmentSchema,
    resolveAssignmentToken,
    attachReaderContext,
    updateAssignmentFromSession
} = require('../services/scorm/ScormFlipbookAssignmentService');

function forwardedIp(req) {
    const header = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return header || req.ip || req.socket?.remoteAddress || '';
}

function assignmentTokenFromSource(source) {
    const value = String(source || '');
    return value.startsWith('assignment:') ? value.slice('assignment:'.length).trim() : '';
}

async function publicBook(shareToken) {
    return Flipbook.findOne({ where: { shareToken, status: 'published', shareEnabled: true } });
}

// Assigned Flipbooks reuse the normal public reader, but the opaque assignment
// token binds the analytics session to the exact learner, campaign and optional
// course. The learner-entered email can never change assignment attribution.
router.post('/public/:shareToken/session', async (req, res, next) => {
    const assignmentToken = assignmentTokenFromSource(req.body?.source);
    if (!assignmentToken) return next();
    try {
        await ensureFlipbookAssignmentSchema();
        const book = await publicBook(req.params.shareToken);
        if (!book) return res.status(404).json({ message: 'This Flipbook is not available.' });
        const assignment = await resolveAssignmentToken({ token: assignmentToken, flipbookId: book.id });
        const sessionResult = await startReaderSession({
            book,
            email: assignment.learnerEmail,
            name: assignment.learnerName || req.body?.name,
            source: 'assignment',
            userAgent: req.headers['user-agent'] || '',
            referrer: req.body?.referrer || req.headers.referer || '',
            ipAddress: forwardedIp(req)
        });
        const session = await FlipbookReaderSession.findOne({ where: { sessionToken: sessionResult.sessionToken } });
        if (session) {
            await attachReaderContext({ sessionId: session.id, assignment, flipbookId: book.id, sourceType: 'assignment' });
            await updateAssignmentFromSession(session.id);
        }
        res.status(201).json({ ...sessionResult, assignment: true });
    } catch (err) {
        next(err);
    }
});

router.post('/public/:shareToken/session/:sessionToken/events', async (req, res, next) => {
    try {
        await ensureFlipbookAssignmentSchema();
        const session = await FlipbookReaderSession.findOne({ where: { sessionToken: req.params.sessionToken } });
        if (!session) return next();
        const context = await FlipbookReaderContext.findOne({ where: { sessionId: session.id, sourceType: 'assignment' } });
        if (!context) return next();
        const book = await publicBook(req.params.shareToken);
        if (!book || String(book.id) !== String(session.flipbookId)) return res.status(404).json({ message: 'This Flipbook is not available.' });
        const result = await recordReaderEvents({
            book,
            sessionToken: req.params.sessionToken,
            events: req.body?.events || []
        });
        await updateAssignmentFromSession(session.id);
        res.json({ ...result, assignment: true });
    } catch (err) {
        next(err);
    }
});

router.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[flipbook-assignment-tracking]', err);
    res.status(err.status || 500).json({
        message: err.message || 'Assigned Flipbook tracking failed.',
        code: err.code || 'SCORM_FLIPBOOK_ASSIGNMENT_TRACKING_ERROR'
    });
});

module.exports = router;
