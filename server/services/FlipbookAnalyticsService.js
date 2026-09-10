const crypto = require('crypto');
const { Op } = require('sequelize');
const Flipbook = require('../models/Flipbook');
const FlipbookReaderSession = require('../models/FlipbookReaderSession');
const FlipbookReaderEvent = require('../models/FlipbookReaderEvent');

const ALLOWED_EVENTS = new Set(['page_view', 'flip', 'heartbeat', 'complete', 'share']);
let analyticsSchemaPromise = null;

function normaliseEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
    return /^\S+@\S+\.\S+$/.test(normaliseEmail(value));
}

function clampDays(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 30;
    return Math.max(1, Math.min(3650, Math.floor(parsed)));
}

function safeText(value, maxLength) {
    const text = String(value || '').trim();
    return text ? text.slice(0, maxLength) : null;
}

function deviceType(userAgent) {
    const ua = String(userAgent || '').toLowerCase();
    if (/ipad|tablet|kindle|silk/.test(ua)) return 'tablet';
    if (/mobile|iphone|ipod|android/.test(ua)) return 'mobile';
    return 'desktop';
}

function hashIp(ipAddress) {
    const ip = String(ipAddress || '').trim();
    if (!ip) return null;
    const salt = String(process.env.ANALYTICS_HASH_SALT || process.env.JWT_SECRET || 'lmsgen-analytics');
    return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function percent(value, total) {
    return total > 0 ? Math.round((Number(value || 0) / total) * 1000) / 10 : 0;
}

function average(values) {
    const list = values.map(Number).filter(Number.isFinite);
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
}

async function ensureAnalyticsSchema() {
    if (!analyticsSchemaPromise) {
        analyticsSchemaPromise = Promise.all([
            FlipbookReaderSession.sync(),
            FlipbookReaderEvent.sync()
        ]).catch((err) => {
            analyticsSchemaPromise = null;
            throw err;
        });
    }
    await analyticsSchemaPromise;
}

async function startReaderSession({ book, email, name = null, source = 'share', userAgent = '', referrer = '', ipAddress = '' }) {
    await ensureAnalyticsSchema();
    const readerEmail = normaliseEmail(email);
    if (!isValidEmail(readerEmail)) {
        const err = new Error('Enter a valid email address to open this flipbook.');
        err.status = 400;
        err.code = 'FLIPBOOK_READER_EMAIL_INVALID';
        throw err;
    }
    const pageCount = Math.max(0, Number(book.pageCount || 0));
    const session = await FlipbookReaderSession.create({
        flipbookId: book.id,
        ownerUserId: book.ownerUserId,
        readerEmail,
        readerName: safeText(name, 160),
        sessionToken: crypto.randomBytes(24).toString('hex'),
        source: safeText(source, 64) || 'share',
        startedAt: new Date(),
        lastSeenAt: new Date(),
        pageCount,
        uniquePages: pageCount ? [0] : [],
        lastPageIndex: 0,
        maxPageIndex: 0,
        flipCount: 0,
        durationSeconds: 0,
        deviceType: deviceType(userAgent),
        userAgent: safeText(userAgent, 500),
        referrer: safeText(referrer, 1000),
        ipHash: hashIp(ipAddress)
    });

    const initialEvents = [{
        sessionId: session.id,
        flipbookId: book.id,
        ownerUserId: book.ownerUserId,
        readerEmail,
        eventType: 'open',
        pageIndex: pageCount ? 0 : null,
        metadata: { source: session.source }
    }];
    if (pageCount) {
        initialEvents.push({
            sessionId: session.id,
            flipbookId: book.id,
            ownerUserId: book.ownerUserId,
            readerEmail,
            eventType: 'page_view',
            pageIndex: 0,
            metadata: { initial: true }
        });
    }
    await FlipbookReaderEvent.bulkCreate(initialEvents);

    book.viewCount = Number(book.viewCount || 0) + 1;
    book.lastViewedAt = new Date();
    await book.save();

    return {
        sessionToken: session.sessionToken,
        readerEmail: session.readerEmail,
        readerName: session.readerName,
        startedAt: session.startedAt
    };
}

function cleanEvent(raw, pageCount) {
    const eventType = String(raw?.eventType || '').trim().toLowerCase();
    if (!ALLOWED_EVENTS.has(eventType)) return null;
    let pageIndex = raw?.pageIndex === null || raw?.pageIndex === undefined ? null : Number(raw.pageIndex);
    if (pageIndex !== null) {
        if (!Number.isFinite(pageIndex)) pageIndex = null;
        else pageIndex = Math.max(0, Math.min(Math.max(0, pageCount - 1), Math.floor(pageIndex)));
    }
    const elapsed = Number(raw?.elapsedSeconds);
    return {
        eventType,
        pageIndex,
        elapsedSeconds: Number.isFinite(elapsed) ? Math.max(0, Math.min(24 * 60 * 60, Math.floor(elapsed))) : null,
        direction: ['forward', 'backward'].includes(String(raw?.direction || '').toLowerCase()) ? String(raw.direction).toLowerCase() : null,
        metadata: raw?.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {}
    };
}

async function recordReaderEvents({ book, sessionToken, events = [] }) {
    await ensureAnalyticsSchema();
    const session = await FlipbookReaderSession.findOne({
        where: { sessionToken: String(sessionToken || ''), flipbookId: book.id }
    });
    if (!session) {
        const err = new Error('Reader session expired. Reopen the shared flipbook link.');
        err.status = 404;
        err.code = 'FLIPBOOK_READER_SESSION_NOT_FOUND';
        throw err;
    }

    const pageCount = Math.max(0, Number(session.pageCount || book.pageCount || 0));
    const cleaned = (Array.isArray(events) ? events : [events]).slice(0, 50).map((event) => cleanEvent(event, pageCount)).filter(Boolean);
    if (!cleaned.length) return { ok: true, sessionToken: session.sessionToken };

    const uniquePages = new Set((Array.isArray(session.uniquePages) ? session.uniquePages : []).map(Number).filter(Number.isFinite));
    let lastPageIndex = Number(session.lastPageIndex || 0);
    let maxPageIndex = Number(session.maxPageIndex || 0);
    let flipCount = Number(session.flipCount || 0);
    let durationSeconds = Number(session.durationSeconds || 0);
    let completedAt = session.completedAt || null;

    const rows = [];
    for (const event of cleaned) {
        if (event.elapsedSeconds !== null) durationSeconds = Math.max(durationSeconds, event.elapsedSeconds);
        if (event.pageIndex !== null && ['page_view', 'flip', 'complete'].includes(event.eventType)) {
            uniquePages.add(event.pageIndex);
            lastPageIndex = event.pageIndex;
            maxPageIndex = Math.max(maxPageIndex, event.pageIndex);
        }
        if (event.eventType === 'flip') flipCount += 1;
        if (event.eventType === 'complete' || (pageCount > 0 && event.pageIndex === pageCount - 1)) {
            completedAt = completedAt || new Date();
        }
        rows.push({
            sessionId: session.id,
            flipbookId: book.id,
            ownerUserId: book.ownerUserId,
            readerEmail: session.readerEmail,
            eventType: event.eventType,
            pageIndex: event.pageIndex,
            direction: event.direction,
            occurredAt: new Date(),
            metadata: event.metadata
        });
    }

    if (rows.length) await FlipbookReaderEvent.bulkCreate(rows);
    session.uniquePages = [...uniquePages].sort((a, b) => a - b);
    session.lastPageIndex = lastPageIndex;
    session.maxPageIndex = maxPageIndex;
    session.flipCount = flipCount;
    session.durationSeconds = durationSeconds;
    session.completedAt = completedAt;
    session.lastSeenAt = new Date();
    await session.save();

    return {
        ok: true,
        sessionToken: session.sessionToken,
        uniquePages: session.uniquePages.length,
        lastPageIndex: session.lastPageIndex,
        maxPageIndex: session.maxPageIndex,
        flipCount: session.flipCount,
        durationSeconds: session.durationSeconds,
        completed: Boolean(session.completedAt)
    };
}

function readerRows(sessions) {
    const map = new Map();
    sessions.forEach((session) => {
        const email = normaliseEmail(session.readerEmail);
        if (!map.has(email)) {
            map.set(email, {
                email,
                name: session.readerName || null,
                sessions: 0,
                flips: 0,
                durationSeconds: 0,
                maxPageIndex: 0,
                pages: new Set(),
                completed: false,
                lastSeenAt: null,
                deviceTypes: new Set()
            });
        }
        const row = map.get(email);
        row.name = row.name || session.readerName || null;
        row.sessions += 1;
        row.flips += Number(session.flipCount || 0);
        row.durationSeconds += Number(session.durationSeconds || 0);
        row.maxPageIndex = Math.max(row.maxPageIndex, Number(session.maxPageIndex || 0));
        (Array.isArray(session.uniquePages) ? session.uniquePages : []).forEach((page) => row.pages.add(Number(page)));
        row.completed = row.completed || Boolean(session.completedAt);
        if (!row.lastSeenAt || new Date(session.lastSeenAt) > new Date(row.lastSeenAt)) row.lastSeenAt = session.lastSeenAt;
        if (session.deviceType) row.deviceTypes.add(session.deviceType);
    });
    return [...map.values()].map((row) => ({
        email: row.email,
        name: row.name,
        sessions: row.sessions,
        flips: row.flips,
        durationSeconds: row.durationSeconds,
        maxPageReached: row.maxPageIndex + 1,
        uniquePagesViewed: row.pages.size,
        completed: row.completed,
        lastSeenAt: row.lastSeenAt,
        devices: [...row.deviceTypes]
    })).sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
}

async function getBookAnalytics({ book, days = 30 }) {
    await ensureAnalyticsSchema();
    const rangeDays = clampDays(days);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const [sessions, events] = await Promise.all([
        FlipbookReaderSession.findAll({
            where: { flipbookId: book.id, startedAt: { [Op.gte]: since } },
            order: [['startedAt', 'DESC']]
        }),
        FlipbookReaderEvent.findAll({
            where: { flipbookId: book.id, occurredAt: { [Op.gte]: since } },
            attributes: ['readerEmail', 'eventType', 'pageIndex', 'occurredAt']
        })
    ]);

    const readers = readerRows(sessions);
    const uniqueReaders = readers.length;
    const completedSessions = sessions.filter((session) => Boolean(session.completedAt)).length;
    const pageCount = Math.max(0, Number(book.pageCount || 0));
    const pageAnalytics = Array.from({ length: pageCount }, (_, pageIndex) => {
        const arrivals = events.filter((event) => ['page_view', 'flip'].includes(event.eventType) && Number(event.pageIndex) === pageIndex);
        const uniquePageReaders = new Set(arrivals.map((event) => normaliseEmail(event.readerEmail)).filter(Boolean));
        const exits = sessions.filter((session) => Number(session.lastPageIndex || 0) === pageIndex).length;
        return {
            page: pageIndex + 1,
            label: pageIndex === 0 ? 'Cover' : (pageIndex === pageCount - 1 ? 'Back cover' : `Page ${pageIndex + 1}`),
            views: arrivals.length,
            uniqueReaders: uniquePageReaders.size,
            reachRate: percent(uniquePageReaders.size, uniqueReaders),
            exits
        };
    });

    return {
        rangeDays,
        book: {
            id: book.id,
            title: book.title,
            pageCount,
            publishedAt: book.publishedAt || null,
            lifetimeViews: Number(book.viewCount || 0)
        },
        summary: {
            uniqueReaders,
            sessions: sessions.length,
            totalFlips: sessions.reduce((sum, session) => sum + Number(session.flipCount || 0), 0),
            completedSessions,
            completionRate: percent(completedSessions, sessions.length),
            averageDurationSeconds: average(sessions.map((session) => session.durationSeconds)),
            averagePagesViewed: sessions.length ? Math.round((sessions.reduce((sum, session) => sum + (Array.isArray(session.uniquePages) ? session.uniquePages.length : 0), 0) / sessions.length) * 10) / 10 : 0,
            averageDepthPercent: sessions.length && pageCount ? Math.round((sessions.reduce((sum, session) => sum + percent((Array.isArray(session.uniquePages) ? session.uniquePages.length : 0), pageCount), 0) / sessions.length) * 10) / 10 : 0
        },
        readers,
        pageAnalytics,
        recentSessions: sessions.slice(0, 75).map((session) => ({
            id: session.id,
            email: session.readerEmail,
            name: session.readerName || null,
            startedAt: session.startedAt,
            lastSeenAt: session.lastSeenAt,
            durationSeconds: Number(session.durationSeconds || 0),
            uniquePagesViewed: Array.isArray(session.uniquePages) ? session.uniquePages.length : 0,
            lastPageReached: Number(session.lastPageIndex || 0) + 1,
            maxPageReached: Number(session.maxPageIndex || 0) + 1,
            flips: Number(session.flipCount || 0),
            completed: Boolean(session.completedAt),
            deviceType: session.deviceType || 'unknown',
            source: session.source || 'share'
        }))
    };
}

async function getLibraryAnalytics({ ownerUserId, days = 30 }) {
    await ensureAnalyticsSchema();
    const rangeDays = clampDays(days);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const books = await Flipbook.findAll({ where: { ownerUserId }, order: [['updatedAt', 'DESC']] });
    const bookIds = books.map((book) => book.id);
    const sessions = bookIds.length ? await FlipbookReaderSession.findAll({
        where: { ownerUserId, flipbookId: { [Op.in]: bookIds }, startedAt: { [Op.gte]: since } },
        order: [['startedAt', 'DESC']]
    }) : [];

    const sessionsByBook = new Map();
    books.forEach((book) => sessionsByBook.set(String(book.id), []));
    sessions.forEach((session) => {
        const key = String(session.flipbookId);
        if (!sessionsByBook.has(key)) sessionsByBook.set(key, []);
        sessionsByBook.get(key).push(session);
    });

    const bookStats = books.map((book) => {
        const rows = sessionsByBook.get(String(book.id)) || [];
        const readers = new Set(rows.map((row) => normaliseEmail(row.readerEmail)).filter(Boolean));
        const completions = rows.filter((row) => Boolean(row.completedAt)).length;
        const flips = rows.reduce((sum, row) => sum + Number(row.flipCount || 0), 0);
        const duration = rows.reduce((sum, row) => sum + Number(row.durationSeconds || 0), 0);
        const trendingScore = Math.round((readers.size * 8) + (rows.length * 3) + (flips * 0.35) + (completions * 5) + (duration / 120));
        return {
            id: book.id,
            title: book.title,
            pageCount: Number(book.pageCount || 0),
            status: book.status,
            lifetimeViews: Number(book.viewCount || 0),
            uniqueReaders: readers.size,
            sessions: rows.length,
            flips,
            completionRate: percent(completions, rows.length),
            averageDurationSeconds: average(rows.map((row) => row.durationSeconds)),
            trendingScore
        };
    }).sort((a, b) => b.trendingScore - a.trendingScore || b.uniqueReaders - a.uniqueReaders);

    const readers = readerRows(sessions);
    const uniqueReaders = readers.length;
    const completed = sessions.filter((session) => Boolean(session.completedAt)).length;
    return {
        rangeDays,
        summary: {
            flipbooks: books.length,
            uniqueReaders,
            sessions: sessions.length,
            totalFlips: sessions.reduce((sum, session) => sum + Number(session.flipCount || 0), 0),
            completionRate: percent(completed, sessions.length),
            averageDurationSeconds: average(sessions.map((session) => session.durationSeconds))
        },
        trending: bookStats,
        topReaders: readers.slice(0, 100),
        recentActivity: sessions.slice(0, 75).map((session) => {
            const book = books.find((item) => String(item.id) === String(session.flipbookId));
            return {
                id: session.id,
                flipbookId: session.flipbookId,
                flipbookTitle: book?.title || 'Flipbook',
                email: session.readerEmail,
                name: session.readerName || null,
                startedAt: session.startedAt,
                lastSeenAt: session.lastSeenAt,
                durationSeconds: Number(session.durationSeconds || 0),
                maxPageReached: Number(session.maxPageIndex || 0) + 1,
                uniquePagesViewed: Array.isArray(session.uniquePages) ? session.uniquePages.length : 0,
                flips: Number(session.flipCount || 0),
                completed: Boolean(session.completedAt),
                deviceType: session.deviceType || 'unknown'
            };
        })
    };
}

module.exports = {
    ensureAnalyticsSchema,
    startReaderSession,
    recordReaderEvents,
    getBookAnalytics,
    getLibraryAnalytics
};
