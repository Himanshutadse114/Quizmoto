const { expect } = require('chai');
const {
    deriveProgress,
    locationLabel,
    serializeRegistration,
    authoredPartCount,
    packageAnalysis
} = require('../services/scorm/ScormProgressService');

function packageRow(overrides = {}) {
    return {
        analysisJson: JSON.stringify({
            title: 'Security Awareness',
            slides: [
                { title: 'Recognise the threat' },
                { title: 'Verify the message' },
                { title: 'Report safely' }
            ],
            quiz: [
                { question: 'Question one' },
                { question: 'Question two' }
            ]
        }),
        ...overrides
    };
}

describe('ScormProgressService', () => {
    it('calculates authored module progress from the saved lesson location', () => {
        const pkg = packageRow();
        expect(authoredPartCount(pkg)).to.equal(7);
        expect(deriveProgress({
            registration: { status: 'active' },
            cmiState: { lessonStatus: 'incomplete', lessonLocation: '3', values: {} },
            packageRow: pkg
        })).to.equal(50);
    });

    it('uses an explicit v2 progress percentage when supplied', () => {
        expect(deriveProgress({
            registration: { status: 'active' },
            cmiState: {
                lessonStatus: 'incomplete',
                lessonLocation: 'chapter-2',
                progressPercent: 62.5,
                values: { 'cmi.progress_measure': '0.625' }
            },
            packageRow: { analysisJson: null }
        })).to.equal(62.5);
    });

    it('uses SCORM 2004 cmi.progress_measure when supplied in the saved state map', () => {
        expect(deriveProgress({
            registration: { status: 'active' },
            cmiState: {
                lessonStatus: 'incomplete',
                lessonLocation: 'chapter-2',
                values: { 'cmi.progress_measure': '0.625' }
            },
            packageRow: { analysisJson: null }
        })).to.equal(62.5);
    });

    it('returns 100 percent for a finished registration', () => {
        expect(deriveProgress({
            registration: { status: 'completed', lastLessonStatus: 'passed' },
            cmiState: { lessonStatus: 'passed', values: {} },
            packageRow: packageRow()
        })).to.equal(100);
    });

    it('does not invent a percentage for third-party SCORM 1.2 without a progress signal', () => {
        expect(deriveProgress({
            registration: { status: 'active', lastLessonStatus: 'incomplete' },
            cmiState: {
                lessonStatus: 'incomplete',
                lessonLocation: 'chapter-two',
                values: {}
            },
            packageRow: { analysisJson: null }
        })).to.equal(null);
    });

    it('maps authored lesson locations to meaningful screen labels', () => {
        const pkg = packageRow();
        expect(locationLabel({ registration: { status: 'active' }, cmiState: { lessonLocation: '0', values: {} }, packageRow: pkg })).to.equal('Introduction');
        expect(locationLabel({ registration: { status: 'active' }, cmiState: { lessonLocation: '2', values: {} }, packageRow: pkg })).to.equal('Verify the message');
        expect(locationLabel({ registration: { status: 'active' }, cmiState: { lessonLocation: '4', values: {} }, packageRow: pkg })).to.equal('Knowledge check 1');
        expect(locationLabel({ registration: { status: 'active' }, cmiState: { lessonLocation: '6', values: {} }, packageRow: pkg })).to.equal('Completion screen');
    });

    it('serializes v2 learning state separately from the registration row', () => {
        const row = serializeRegistration({
            id: 'reg-1',
            status: 'active',
            lastLessonStatus: 'incomplete',
            learningStateV2: {
                lessonStatus: 'incomplete',
                lessonLocation: 'external-page',
                values: {},
                sequence: 4
            }
        }, {
            id: 'course-1',
            title: 'External course',
            inviteCode: 'ABC123',
            package: { analysisJson: null }
        });
        expect(row.progressPercent).to.equal(null);
        expect(row.progressAvailable).to.equal(false);
        expect(row.lastLocation).to.equal('external-page');
        expect(row.stateVersion).to.equal(4);
    });

    it('does not serialize the entire course association for every learner row', () => {
        let courseToJsonCalls = 0;
        const pkg = packageRow();
        const course = {
            title: 'Large roster course',
            status: 'published',
            inviteCode: 'LARGE1',
            package: pkg,
            registrations: new Array(500).fill({ id: 'unused' }),
            toJSON() {
                courseToJsonCalls += 1;
                throw new Error('course.toJSON should not be called by row serialization');
            }
        };

        const row = serializeRegistration({
            id: 'reg-fast',
            status: 'active',
            learningStateV2: { lessonStatus: 'incomplete', lessonLocation: '2', values: {}, sequence: 2 }
        }, course);

        expect(courseToJsonCalls).to.equal(0);
        expect(row.courseTitle).to.equal('Large roster course');
        expect(row.progressPercent).to.be.a('number');
    });

    it('reuses parsed package analysis while the package payload is unchanged', () => {
        const pkg = packageRow();
        const first = packageAnalysis(pkg);
        const second = packageAnalysis(pkg);
        expect(second).to.equal(first);
        pkg.analysisJson = JSON.stringify({ slides: [{ title: 'Changed' }], quiz: [] });
        expect(packageAnalysis(pkg)).to.not.equal(first);
    });
});
