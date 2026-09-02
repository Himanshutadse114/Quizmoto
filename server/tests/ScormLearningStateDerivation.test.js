const { expect } = require('chai');
const {
    deriveState,
    normalizeStatus
} = require('../services/scorm/ScormLearningStateService');

describe('SCORM canonical state derivation', () => {
    it('does not let a SCORM 1.2 default hide SCORM 2004 completion', () => {
        const values = {
            'cmi.core.lesson_status': 'not attempted',
            'cmi.completion_status': 'completed',
            'cmi.progress_measure': '0'
        };
        expect(normalizeStatus(values)).to.equal('completed');
        const state = deriveState(values, null);
        expect(state.lessonStatus).to.equal('completed');
        expect(state.progressPercent).to.equal(100);
    });

    it('lets success status win over incomplete placeholder status', () => {
        const state = deriveState({
            'cmi.core.lesson_status': 'incomplete',
            'cmi.completion_status': 'completed',
            'cmi.success_status': 'passed',
            'cmi.progress_measure': '0.25'
        }, null);
        expect(state.lessonStatus).to.equal('passed');
        expect(state.progressPercent).to.equal(100);
    });

    it('uses the player absolute cumulative clock idempotently', () => {
        const state = deriveState({
            'cmi.core.lesson_status': 'incomplete',
            'cmi.core.session_time': '00:01:15.50',
            'quizmoto.total_time_seconds': '75.5'
        }, {
            lessonStatus: 'incomplete',
            totalTime: '00:00:50.00',
            progressPercent: 20
        });
        expect(state.totalTime).to.equal('00:01:15.50');
        expect(state.progressPercent).to.equal(20);
    });

    it('recovers partial progress from authored suspend data', () => {
        const state = deriveState({
            'cmi.core.lesson_status': 'incomplete',
            'cmi.suspend_data': JSON.stringify({ quizmotoProgress: 63 })
        }, null);
        expect(state.progressPercent).to.equal(63);
    });
});
