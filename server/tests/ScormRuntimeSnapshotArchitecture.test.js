const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const LearningState = require('../services/scorm/ScormLearningStateService');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('SCORM local-first learning state architecture', () => {
    it('stores one complete learner state document per registration', () => {
        const store = source('services/scorm/ScormLearningStateService.js');
        expect(store).to.include('CREATE TABLE IF NOT EXISTS scorm_learning_state_v2');
        expect(store).to.include('registration_id UUID PRIMARY KEY');
        expect(store).to.include('state_json TEXT NOT NULL');
        expect(store).to.include('ON CONFLICT (registration_id) DO UPDATE SET');
        expect(store).to.include('sequence = scorm_learning_state_v2.sequence + 1');
    });

    it('player SCORM calls are local and do not depend on runtime RPC', () => {
        const player = source('routes/scorm/play.js');
        expect(player).to.include("const sessionEndpoint = '/api/scorm/session/' + reg.id");
        expect(player).to.not.include('/api/scorm/runtime/');
        expect(player).to.include('localValues[key]=v==null?"":String(v)');
        expect(player).to.include('fetch(SESSION,{method:"POST"');
        expect(player).to.include('navigator.sendBeacon');
    });

    it('host tracking reads only the v2 attempt state instead of legacy runtime tables', () => {
        const tracking = source('routes/scorm/tracking.js');
        expect(tracking).to.include("require('../../services/scorm/ScormLearningStateService')");
        expect(tracking).to.include('LearningState.listByRegistrationIds');
        expect(tracking).to.not.include('ScormRuntimeSnapshot');
        expect(tracking).to.not.include('ScormCmiState');
    });

    it('derives SCORM 1.2 status, location and score from a full state document', () => {
        const state = LearningState.deriveState({
            'cmi.core.lesson_status': 'incomplete',
            'cmi.core.lesson_location': '4',
            'cmi.core.score.raw': '80',
            'cmi.suspend_data': '{"screen":4}'
        });
        expect(state.lessonStatus).to.equal('incomplete');
        expect(state.lessonLocation).to.equal('4');
        expect(state.scoreRaw).to.equal(80);
        expect(state.suspendData).to.equal('{"screen":4}');
    });

    it('derives SCORM 2004 completion and progress measure without the old CMI model', () => {
        const state = LearningState.deriveState({
            'cmi.completion_status': 'incomplete',
            'cmi.success_status': 'unknown',
            'cmi.location': 'chapter-3',
            'cmi.progress_measure': '0.73'
        });
        expect(state.lessonStatus).to.equal('incomplete');
        expect(state.lessonLocation).to.equal('chapter-3');
        expect(state.progressPercent).to.equal(73);
    });
});
