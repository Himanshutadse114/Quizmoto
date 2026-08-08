const { expect } = require('chai');
const {
    deriveProgress,
    locationLabel,
    serializeRegistration,
    authoredPartCount
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
        // intro + 3 slides + 2 quiz + final = 7 parts; location 3 = 50%.
        expect(authoredPartCount(pkg)).to.equal(7);
        expect(deriveProgress({
            registration: { status: 'active' },
            cmiState: { lessonStatus: 'incomplete', lessonLocation: '3', rawMapJson: '{}' },
            packageRow: pkg
        })).to.equal(50);
    });

    it('uses SCORM 2004 cmi.progress_measure when supplied', () => {
        expect(deriveProgress({
            registration: { status: 'active' },
            cmiState: {
                lessonStatus: 'incomplete',
                lessonLocation: 'chapter-2',
                rawMapJson: JSON.stringify({ 'cmi.progress_measure': '0.625' })
            },
            packageRow: { analysisJson: null }
        })).to.equal(62.5);
    });

    it('returns 100 percent for a finished registration', () => {
        expect(deriveProgress({
            registration: { status: 'completed', lastLessonStatus: 'passed' },
            cmiState: { lessonStatus: 'passed', rawMapJson: '{}' },
            packageRow: packageRow()
        })).to.equal(100);
    });

    it('does not invent a percentage for third-party SCORM 1.2 without a progress signal', () => {
        expect(deriveProgress({
            registration: { status: 'active', lastLessonStatus: 'incomplete' },
            cmiState: {
                lessonStatus: 'incomplete',
                lessonLocation: 'chapter-two',
                rawMapJson: '{}'
            },
            packageRow: { analysisJson: null }
        })).to.equal(null);
    });

    it('maps authored lesson locations to meaningful screen labels', () => {
        const pkg = packageRow();
        expect(locationLabel({
            registration: { status: 'active' },
            cmiState: { lessonLocation: '0' },
            packageRow: pkg
        })).to.equal('Introduction');
        expect(locationLabel({
            registration: { status: 'active' },
            cmiState: { lessonLocation: '2' },
            packageRow: pkg
        })).to.equal('Verify the message');
        expect(locationLabel({
            registration: { status: 'active' },
            cmiState: { lessonLocation: '4' },
            packageRow: pkg
        })).to.equal('Knowledge check 1');
        expect(locationLabel({
            registration: { status: 'active' },
            cmiState: { lessonLocation: '6' },
            packageRow: pkg
        })).to.equal('Completion screen');
    });

    it('serializes availability separately from progress value', () => {
        const row = serializeRegistration({
            id: 'reg-1',
            status: 'active',
            lastLessonStatus: 'incomplete',
            cmiState: {
                lessonStatus: 'incomplete',
                lessonLocation: 'external-page',
                rawMapJson: '{}',
                stateVersion: 4
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
});
