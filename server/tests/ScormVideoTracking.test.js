const { expect } = require('chai');
const { _test } = require('../services/scorm/ScormVideoService');

describe('SCORM campaign video tracking', () => {
    it('merges overlapping watched ranges without double-counting time', () => {
        const ranges = _test.normalizeRanges([[0, 5], [4.5, 9], [20, 25]], 30);
        expect(ranges).to.deep.equal([[0, 9], [20, 25]]);
        expect(_test.rangeSeconds(ranges)).to.equal(14);
    });

    it('rejects a seek jump as watched time', () => {
        expect(_test.plausibleWatchSegment({ elapsed: 1, from: 5, to: 90 })).to.equal(false);
    });

    it('accepts normal active playback checkpoints', () => {
        expect(_test.plausibleWatchSegment({ elapsed: 5.1, from: 10, to: 15 })).to.equal(true);
    });

    it('accepts genuine accelerated playback while preserving wall-clock active time', () => {
        expect(_test.plausibleWatchSegment({ elapsed: 5, from: 10, to: 20, playbackRate: 2 })).to.equal(true);
    });
});
