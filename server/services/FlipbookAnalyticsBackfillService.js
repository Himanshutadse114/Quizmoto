const FlipbookReaderSession = require('../models/FlipbookReaderSession');

function expandDesktopSpreadPages(session) {
    const pageCount = Math.max(0, Number(session.pageCount || 0));
    if (String(session.deviceType || '').toLowerCase() !== 'desktop' || pageCount < 3) return null;

    const current = Array.isArray(session.uniquePages) ? session.uniquePages : [];
    const pages = new Set(current.map(Number).filter(Number.isFinite).map((value) => Math.max(0, Math.floor(value))));
    const before = pages.size;

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

    if (pages.size === before) return null;
    return [...pages].sort((a, b) => a - b);
}

async function backfillDesktopSpreadSessions(flipbookId) {
    if (!flipbookId) return { updated: 0 };
    const sessions = await FlipbookReaderSession.findAll({
        where: { flipbookId },
        order: [['startedAt', 'DESC']],
        limit: 1000
    });

    let updated = 0;
    for (const session of sessions) {
        const expanded = expandDesktopSpreadPages(session);
        if (!expanded) continue;
        session.uniquePages = expanded;
        await session.save();
        updated += 1;
    }
    return { updated };
}

module.exports = {
    expandDesktopSpreadPages,
    backfillDesktopSpreadSessions
};
