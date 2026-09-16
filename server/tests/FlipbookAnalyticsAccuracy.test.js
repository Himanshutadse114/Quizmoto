const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru().noPreserveCache();

function serviceWith({ session, eventRows }) {
    const Session = {
        sync: sinon.stub().resolves(),
        findOne: sinon.stub().resolves(session),
        create: sinon.stub()
    };
    const Event = {
        sync: sinon.stub().resolves(),
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
        const clock = sinon.useFakeTimers({ now });
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
});
