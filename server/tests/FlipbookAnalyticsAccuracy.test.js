const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

function serviceWith({ session, eventRows }) {
    const Session = {
        sync: sinon.stub().resolves(),
        findOne: sinon.stub().resolves(session),
        findAll: sinon.stub().resolves([]),
        create: sinon.stub()
    };
    const Event = {
        sync: sinon.stub().resolves(),
        findAll: sinon.stub().callsFake(async ({ where } = {}) => eventRows.filter((row) => (
            (!where?.sessionId || String(row.sessionId) === String(where.sessionId))
            && (typeof where?.eventType !== 'string' || String(row.eventType) === String(where.eventType))
        ))),
        bulkCreate: sinon.stub().callsFake(async (rows) => {
            eventRows.push(...rows);
            return rows;
        })
    };
    const Book = { findAll: sinon.stub() };
    const service = proxyquire('../services/FlipbookAnalyticsService', {
        '../models/Flipbook': Book,
        '../models/FlipbookReaderSession': Session,
        '../models/FlipbookReaderEvent': Event
    });
    return { service, Session, Event };
}

describe('Publica analytics accuracy', () => {
    afterEach(() => sinon.restore());

    it('caps untrusted elapsed time and refuses completion when pages were skipped', async () => {
        const now = new Date('2026-09-16T12:00:00.000Z');
        const clock = sinon.useFakeTimers({ now, toFake: ['Date'] });
        const eventRows = [];
        const session = {
            id: 'session-1',
            sessionToken: 'token-1',
            flipbookId: 'book-1',
            readerEmail: 'reader@example.com',
            startedAt: new Date(now.getTime() - 10 * 60 * 1000),
            lastSeenAt: new Date(now.getTime() - 10 * 1000),
            durationSeconds: 30,
            pageCount: 4,
            uniquePages: [0],
            lastPageIndex: 0,
            maxPageIndex: 0,
            flipCount: 0,
            completedAt: null,
            save: sinon.stub().resolves()
        };
        const { service } = serviceWith({ session, eventRows });
        const book = { id: 'book-1', ownerUserId: 7, pageCount: 4 };

        const partial = await service.recordReaderEvents({
            book,
            sessionToken: 'token-1',
            events: [
                { eventType: 'page_view', pageIndex: 3, elapsedSeconds: 3600 },
                { eventType: 'complete', pageIndex: 3, elapsedSeconds: 3600 }
            ]
        });

        expect(partial.durationSeconds).to.equal(45);
        expect(partial.completed).to.equal(false);
        expect(session.uniquePages).to.deep.equal([0, 3]);
        expect(eventRows.some((row) => row.eventType === 'complete')).to.equal(false);

        clock.tick(10 * 1000);
        const completed = await service.recordReaderEvents({
            book,
            sessionToken: 'token-1',
            events: [
                { eventType: 'page_view', pageIndex: 1, elapsedSeconds: 55 },
                { eventType: 'page_view', pageIndex: 2, elapsedSeconds: 55 }
            ]
        });

        expect(completed.durationSeconds).to.equal(55);
        expect(completed.completed).to.equal(true);
        expect(session.uniquePages).to.deep.equal([0, 1, 2, 3]);
        const completion = eventRows.find((row) => row.eventType === 'complete');
        expect(completion.metadata).to.include({ serverVerified: true, pagesViewed: 4, pageCount: 4 });
    });

    it('returns accumulated active time when a recent reader session resumes', async () => {
        const eventRows = [];
        const recent = {
            sessionToken: 'resume-token',
            readerEmail: 'reader@example.com',
            readerName: 'Reader',
            startedAt: new Date('2026-09-16T11:00:00.000Z'),
            lastSeenAt: new Date('2026-09-16T11:00:45.000Z'),
            durationSeconds: 42,
            lastPageIndex: 3,
            uniquePages: [0, 1, 3],
            completedAt: null,
            save: sinon.stub().resolves()
        };
        const { service } = serviceWith({ session: recent, eventRows });
        const book = { id: 'book-1', ownerUserId: 7, pageCount: 5 };

        const result = await service.startReaderSession({
            book,
            email: 'reader@example.com',
            name: 'Reader',
            userAgent: 'Desktop browser',
            ipAddress: '127.0.0.1'
        });

        expect(result).to.include({
            resumed: true,
            durationSeconds: 42,
            lastPageIndex: 3,
            completed: false
        });
        expect(result.uniquePages).to.deep.equal([0, 1, 3]);
    });

    it('stores cumulative page time without double counting and caps it to credible session time', async () => {
        const now = new Date('2026-09-16T12:00:00.000Z');
        sinon.useFakeTimers({ now, toFake: ['Date'] });
        const eventRows = [];
        const session = {
            id: 'session-1', sessionToken: 'token-1', flipbookId: 'book-1', readerEmail: 'reader@example.com',
            startedAt: new Date(now.getTime() - 60 * 1000), lastSeenAt: new Date(now.getTime() - 20 * 1000),
            durationSeconds: 10, pageCount: 2, uniquePages: [0, 1], lastPageIndex: 1, maxPageIndex: 1,
            flipCount: 1, completedAt: now, save: sinon.stub().resolves()
        };
        const { service } = serviceWith({ session, eventRows });
        const book = { id: 'book-1', ownerUserId: 7, pageCount: 2 };

        const first = await service.recordReaderEvents({
            book, sessionToken: 'token-1', events: [
                { eventType: 'page_time', pageIndex: 0, elapsedSeconds: 30, metadata: { pageActiveMilliseconds: 12000 } },
                { eventType: 'page_time', pageIndex: 1, elapsedSeconds: 30, metadata: { pageActiveMilliseconds: 18000 } }
            ]
        });
        expect(first.durationSeconds).to.equal(30);
        expect(first.pageTimes).to.deep.equal({ 0: 12000, 1: 18000 });

        const duplicate = await service.recordReaderEvents({
            book, sessionToken: 'token-1', events: [
                { eventType: 'page_time', pageIndex: 0, elapsedSeconds: 30, metadata: { pageActiveMilliseconds: 12000 } },
                { eventType: 'page_time', pageIndex: 1, elapsedSeconds: 30, metadata: { pageActiveMilliseconds: 18000 } }
            ]
        });
        expect(duplicate.pageTimes).to.deep.equal({ 0: 12000, 1: 18000 });
        expect(eventRows.filter((row) => row.eventType === 'page_time')).to.have.length(2);
    });

    it('reports per-page active time, engagement and quick skips', async () => {
        const session = {
            id: 'session-1', flipbookId: 'book-1', readerEmail: 'reader@example.com', readerName: 'Reader',
            startedAt: new Date(), lastSeenAt: new Date(), durationSeconds: 8, pageCount: 2,
            uniquePages: [0, 1], lastPageIndex: 1, maxPageIndex: 1, completedAt: new Date(), deviceType: 'mobile'
        };
        const eventRows = [
            { sessionId: 'session-1', eventType: 'page_time', pageIndex: 0, metadata: { pageActiveMilliseconds: 6500 }, occurredAt: new Date() },
            { sessionId: 'session-1', eventType: 'page_time', pageIndex: 1, metadata: { pageActiveMilliseconds: 1500 }, occurredAt: new Date() },
            { sessionId: 'session-1', eventType: 'flip', pageIndex: 1, occurredAt: new Date() }
        ];
        const { service, Session } = serviceWith({ session, eventRows });
        Session.findAll.resolves([session]);

        const analytics = await service.getBookAnalytics({
            book: { id: 'book-1', title: 'Publication', pageCount: 2, viewCount: 1 },
            days: 30
        });

        expect(analytics.pageAnalytics[0]).to.include({ activeSeconds: 6.5, averageActiveSeconds: 6.5, engagedSessions: 1, quickSkips: 0 });
        expect(analytics.pageAnalytics[1]).to.include({ activeSeconds: 1.5, quickSkips: 1, quickSkipRate: 100 });
        expect(analytics.readers[0]).to.include({ mostEngagedPage: 1, mostEngagedPageSeconds: 6.5, quickSkippedPages: 1 });
    });
});
