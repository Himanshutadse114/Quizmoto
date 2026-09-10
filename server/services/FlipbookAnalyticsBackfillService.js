const FlipbookReaderSession = require('../models/FlipbookReaderSession');
const FlipbookReaderEvent = require('../models/FlipbookReaderEvent');

function expandDesktopSpreadPages(session) {
    const pageCount = Math.max(0, Number(session.pageCount || 0));
    if (String(session.deviceType || '').toLowerCase() !== 'desktop' || pageCount < 3) return null;

    const current = Array.isArray(session.uniquePages) ? session.uniquePages : [];
    const existing = new Set(current.map(Number).filter(Number.isFinite).map((value) => Math.max(0, Math.floor(value))));
    const pages = new Set(existing);

    for (const pageIndex of [...pages]) {
        if (pageIndex <= 0 || pageIndex >= pageCount - 1) continue;
        if (pageIndex % 2 === 1) {
            const partner = pageIndex + 1;
            if (partner < pageCount - 1) pages.add(partner);
        } else {
            const partner = pageIndex - 1;
            if (partner > 0) pages.add(partner);
        }
    }

    const expanded = [...pages].sort((a, b) => a - b);
    const addedPages = expanded.filter((pageIndex) => !existing.has(pageIndex));
    return addedPages.length ? { expanded, addedPages } : null;
}

async function backfillDesktopSpreadSessions(flipbookId) {
    if (!flipbookId) return { updated: 0, eventsAdded: 0 };
    const sessions = await FlipbookReaderSession.findAll({
        where: { flipbookId },
        order: [['startedAt', 'DESC']],
        limit: 1000
    });

    let updated = 0;
    let eventsAdded = 0;
    for (const session of sessions) {
        const repair = expandDesktopSpreadPages(session);
        if (!repair) continue;

        session.uniquePages = repair.expanded;
        await session.save();

        const rows = repair.addedPages.map((pageIndex) => ({
            sessionId: session.id,
            flipbookId: session.flipbookId,
            ownerUserId: session.ownerUserId,
            readerEmail: session.readerEmail,
            eventType: 'page_view',
            pageIndex,
            occurredAt: session.lastSeenAt || session.startedAt || new Date(),
            metadata: { backfilledDesktopSpread: true }
        }));
        if (rows.length) {
            await FlipbookReaderEvent.bulkCreate(rows);
            eventsAdded += rows.length;
        }
        updated += 1;
    }
    return { updated, eventsAdded };
}

module.exports = {
    expandDesktopSpreadPages,
    backfillDesktopSpreadSessions
};
