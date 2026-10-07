const { expect } = require('chai');

describe('SCORM duration formatting', () => {
    let formatScormDuration;

    before(async () => {
        ({ formatScormDuration } = await import('../../client/src/utils/scormDuration.js'));
    });

    it('turns SCORM 2004 ISO durations into a readable clock', () => {
        expect(formatScormDuration('PT0H0M19.72S')).to.equal('00:19');
        expect(formatScormDuration('PT1H2M3S')).to.equal('1:02:03');
    });

    it('formats SCORM 1.2 durations and safely handles empty values', () => {
        expect(formatScormDuration('0001:02:03.45')).to.equal('1:02:03');
        expect(formatScormDuration('00:00:00.00')).to.equal('00:00');
        expect(formatScormDuration(null)).to.equal('—');
    });
});

