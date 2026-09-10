const crypto = require('crypto');
const { Op } = require('sequelize');
const Flipbook = require('../models/Flipbook');
const FlipbookReaderSession = require('../models/FlipbookReaderSession');
const FlipbookReaderEvent = require('../models/FlipbookReaderEvent');

const ALLOWED_EVENTS = new Set(['page_view', 'flip', 'heartbeat', 'complete', 'share']);
const SESSION_RESUME_WINDOW_MS = 90 * 1000;
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

function pageSetForSession(session) {
    return new Set(
        (Array.isArray(session?.uniquePages) ? session.uniquePages : [])
            .map(Number)
            .filter(Number.isFinite)
            .map((value) => Math.max(0, Math.floor(value)))
    );
}

function sumFlipCounts(sessions, flipCounts) {
    return sessions.reduce((sum, session) => sum + Number(flipCounts.get(String(session.id)) || 0), 0);
}

function buildFlipCountMap(events = [], sessions = []) {
    const counts = new Map();
    const lastPage = new Map(sessions.map((session) => [String(session.id), 0]));
    const sorted = [...events].sort((a, b) => new Date(a.occurredAt || 0) - new Date(b.occurredAt || 0));

    sorted.forEach((event) => {
        if (String(event.eventType || '').toLowerCase() !== 'flip') return;
        const sessionId = String(event.sessionId || '');
        const pageIndex = Number(event.pageIndex);
        if (!sessionId || !Number.isFinite(pageIndex)) return;
        const previous = Number(lastPage.get(sessionId) ?? 0);
        const next = Math.max(0, Math.floor(pageIndex));
        if (next === previous) return;
        counts.set(sessionId, Number(counts.get(sessionId) || 0) + 1);
        lastPage.set(sessionId, next);
    });

    return counts;
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

    const readerName = safeText(name, 160);
    const readerDevice = deviceType(userAgent);
    const ipHash = hashIp(ipAddress);
    const sourceValue = safeText(source, 64) || 'share';

    if (ipHash) {
        const recent = await FlipbookReaderSession.findOne({
            where: {
                flipbookId: book.id,
                readerEmail,
                ipHash,
                deviceType: readerDevice,
                completedAt: null,
                lastSeenAt: { [Op.gte]: new Date(Date.now() - SESSION_RESUME_WINDOW_MS) }
            },
            order: [['lastSeenAt', 'DESC']]
        });
        if (recent) {
            if (readerName) recent.readerName = readerName;
            recent.source = sourceValue;
            recent.lastSeenAt = new Date();
            await recent.save();
            return {
                sessionToken: recent.sessionToken,
                readerEmail: recent.readerEmail,
                readerName: recent.readerName,
                startedAt: recent.startedAt,
                resumed: true
            };
        }
    }

    const pageCount = Math.max(0, Number(book.pageCount || 0));
    const session = await FlipbookReaderSession.create({
        flipbookId: book.id,
        ownerUserId: book.ownerUserId,
        readerEmail,
        readerName,
        sessionToken: crypto.randomBytes(24).toString('hex'),
        source: sourceValue,
        startedAt: new Date(),
        lastSeenAt: new Date(),
        pageCount,
        uniquePages: pageCount ? [0] : [],
        lastPageIndex: 0,
        maxPageIndex: 0,
        flipCount: 0,
        durationSeconds: 0,
        deviceType: readerDevice,
        userAgent: safeText(userAgent, 500),
        referrer: safeText(referrer, 1000),
        ipHash
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
        startedAt: session.startedAt,
        resumed: false
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
    const cleaned = (Array.isArray(events) ? events : [events])
        .slice(0, 50)
        .map((event) => cleanEvent(event, pageCount))
        .filter(Boolean);
    if (!cleaned.length) return { ok: true, sessionToken: session.sessionToken };

    const uniquePages = pageSetForSession(session);
    let lastPageIndex = Number(session.lastPageIndex || 0);
    let maxPageIndex = Number(session.maxPageIndex || 0);
    let flipCount = Number(session.flipCount || 0);
    let durationSeconds = Number(session.durationSeconds || 0);
    let completedAt = session.completedAt || null;

    const rows = [];
    for (const event of cleaned) {
        if (event.elapsedSeconds !== null) durationSeconds = Math.max(durationSeconds, event.elapsedSeconds);

        if (event.eventType === 'heartbeat') continue;

        if (event.eventType === 'page_view') {
            if (event.pageIndex === null || uniquePages.has(event.pageIndex)) continue;
            uniquePages.add(event.pageIndex);
            maxPageIndex = Math.max(maxPageIndex, event.pageIndex);
        }

        if (event.eventType === 'flip') {
            if (event.pageIndex === null || event.pageIndex === lastPageIndex) continue;
            uniquePages.add(event.pageIndex);
            lastPageIndex = event.pageIndex;
            maxPageIndex = Math.max(maxPageIndex, event.pageIndex);
            flipCount += 1;
        }

        if (event.eventType === 'complete') {
            if (event.pageIndex !== null) {
                uniquePages.add(event.pageIndex);
                lastPageIndex = event.pageIndex;
                maxPageIndex = Math.max(maxPageIndex, event.pageIndex);
            }
            if (completedAt) continue;
            completedAt = new Date();
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

function readerRows(sessions, flipCounts = new Map(), { multiBook = false } = {}) {
    const map = new Map();
    sessions.forEach((session) => {
        const email = normaliseEmail(session.readerEmail);
        if (!email) return;
        if (!map.has(email)) {
            map.set(email, {
                email,
                name: session.readerName || null,
                sessions: 0,
                flips: 0,
                durationSeconds: 0,
                maxPageIndex: 0,
                pages: new Set(),
                books: new Set(),
                completed: false,
                lastSeenAt: null,
                deviceTypes: new Set()
            });
        }
        const row = map.get(email);
        row.name = row.name || session.readerName || null;
        row.sessions += 1;
        row.flips += Number(flipCounts.get(String(session.id)) || 0);
        row.durationSeconds += Number(session.durationSeconds || 0);
        row.maxPageIndex = Math.max(row.maxPageIndex, Number(session.maxPageIndex || 0));
        row.books.add(String(session.flipbookId || ''));
        pageSetForSession(session).forEach((page) => {
            row.pages.add(multiBook ? `${session.flipbookId}:${page}` : page);
        });
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
        flipbooksRead: [...row.books].filter(Boolean).length,
        completed: row.completed,
        lastSeenAt: row.lastSeenAt,
        devices: [...row.deviceTypes]
    })).sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));
}

async function getBookAnalytics({ book, days = 30 }) {
    await ensureAnalyticsSchema();
    const rangeDays = clampDays(days);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const [sessions, flipEvents] = await Promise.all([
        FlipbookReaderSession.findAll({
            where: { flipbookId: book.id, startedAt: { [Op.gte]: since } },
            order: [['startedAt', 'DESC']]
        }),
        FlipbookReaderEvent.findAll({
            where: { flipbookId: book.id, eventType: 'flip', occurredAt: { [Op.gte]: since } },
            attributes: ['sessionId', 'eventType', 'pageIndex', 'occurredAt']
        })
    ]);

    const flipCounts = buildFlipCountMap(flipEvents, sessions);
    const readers = readerRows(sessions, flipCounts);
    const uniqueReaders = readers.length;
    const completedReaders = readers.filter((reader) => reader.completed).length;
    const completedSessions = sessions.filter((session) => Boolean(session.completedAt)).length;
    const pageCount = Math.max(0, Number(book.pageCount || 0));

    const pageAnalytics = Array.from({ length: pageCount }, (_, pageIndex) => {
        const pageSessions = sessions.filter((session) => pageSetForSession(session).has(pageIndex));
        const pageReaders = new Set(pageSessions.map((session) => normaliseEmail(session.readerEmail)).filter(Boolean));
        const exitSessions = sessions.filter((session) => Number(session.lastPageIndex || 0) === pageIndex);
        const exitReaders = new Set(exitSessions.map((session) => normaliseEmail(session.readerEmail)).filter(Boolean));
        return {
            page: pageIndex + 1,
            label: pageIndex === 0 ? 'Cover' : (pageIndex === pageCount - 1 ? 'Back cover' : `Page ${pageIndex + 1}`),
            views: pageSessions.length,
            uniqueReaders: pageReaders.size,
            reachRate: percent(pageReaders.size, uniqueReaders),
            exits: exitSessions.length,
            exitReaders: exitReaders.size
        };
    });

    const averagePagesViewed = readers.length
        ? Math.round((readers.reduce((sum, reader) => sum + Number(reader.uniquePagesViewed || 0), 0) / readers.length) * 10) / 10
        : 0;
    const averageDepthPercent = readers.length && pageCount
        ? Math.round((readers.reduce((sum, reader) => sum + percent(reader.uniquePagesViewed, pageCount), 0) / readers.length) * 10) / 10
        : 0;

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
            totalFlips: sumFlipCounts(sessions, flipCounts),
            completedReaders,
            completedSessions,
            completionRate: percent(completedReaders, uniqueReaders),
            sessionCompletionRate: percent(completedSessions, sessions.length),
            averageDurationSeconds: average(readers.map((reader) => reader.durationSeconds)),
            averageSessionDurationSeconds: average(sessions.map((session) => session.durationSeconds)),
            averagePagesViewed,
            averageDepthPercent
        },
        readers,
        pageAnalytics
    };
}

async function getLibraryAnalytics({ ownerUserId, days = 30 }) {
    await ensureAnalyticsSchema();
    const rangeDays = clampDays(days);
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const books = await Flipbook.findAll({ where: { ownerUserId }, order: [['updatedAt', 'DESC']] });
    const bookIds = books.map((book) => book.id);
    const [sessions, flipEvents] = bookIds.length ? await Promise.all([
        FlipbookReaderSession.findAll({
            where: { ownerUserId, flipbookId: { [Op.in]: bookIds }, startedAt: { [Op.gte]: since } },
            order: [['startedAt', 'DESC']]
        }),
        FlipbookReaderEvent.findAll({
            where: { ownerUserId, flipbookId: { [Op.in]: bookIds }, eventType: 'flip', occurredAt: { [Op.gte]: since } },
            attributes: ['sessionId', 'eventType', 'pageIndex', 'occurredAt']
        })
    ]) : [[], []];

    const flipCounts = buildFlipCountMap(flipEvents, sessions);
    const sessionsByBook = new Map();
    books.forEach((book) => sessionsByBook.set(String(book.id), []));
    sessions.forEach((session) => {
        const key = String(session.flipbookId);
        if (!sessionsByBook.has(key)) sessionsByBook.set(key, []);
        sessionsByBook.get(key).push(session);
    });

    const bookStats = books.map((book) => {
        const rows = sessionsByBook.get(String(book.id)) || [];
        const readers = readerRows(rows, flipCounts);
        const uniqueReaders = readers.length;
        const completedReaders = readers.filter((reader) => reader.completed).length;
        const completionRate = percent(completedReaders, uniqueReaders);
        const pageCount = Math.max(0, Number(book.pageCount || 0));
        const averageDepthPercent = readers.length && pageCount
            ? Math.round((readers.reduce((sum, reader) => sum + percent(reader.uniquePagesViewed, pageCount), 0) / readers.length) * 10) / 10
            : 0;
        const flips = sumFlipCounts(rows, flipCounts);
        const trendingScore = Math.round((uniqueReaders * 10) + (completionRate * 0.2) + (averageDepthPercent * 0.1));
        return {
            id: book.id,
            title: book.title,
            pageCount,
            status: book.status,
            lifetimeViews: Number(book.viewCount || 0),
            uniqueReaders,
            sessions: rows.length,
            flips,
            completionRate,
            averageDepthPercent,
            averageDurationSeconds: average(readers.map((reader) => reader.durationSeconds)),
            trendingScore
        };
    }).sort((a, b) => b.trendingScore - a.trendingScore || b.uniqueReaders - a.uniqueReaders);

    const readers = readerRows(sessions, flipCounts, { multiBook: true });
    const uniqueReaders = readers.length;
    const completedReaders = readers.filter((reader) => reader.completed).length;
    return {
        rangeDays,
        summary: {
            flipbooks: books.length,
            uniqueReaders,
            sessions: sessions.length,
            totalFlips: sumFlipCounts(sessions, flipCounts),
            completedReaders,
            completionRate: percent(completedReaders, uniqueReaders),
            averageDurationSeconds: average(readers.map((reader) => reader.durationSeconds))
        },
        trending: bookStats,
        topReaders: readers.slice(0, 100)
    };
}

module.exports = {
    ensureAnalyticsSchema,
    startReaderSession,
    recordReaderEvents,
    getBookAnalytics,
    getLibraryAnalytics
};
