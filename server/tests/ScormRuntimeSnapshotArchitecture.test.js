const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const RuntimeStore = require('../services/scorm/ScormRuntimeSnapshotStore');

function source(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

describe('SCORM canonical runtime snapshot architecture', () => {
    it('stores one canonical payload per registration', () => {
        const model = source('models/scorm/ScormRuntimeSnapshot.js');
        expect(model).to.include("tableName: 'scorm_runtime_snapshots'");
        expect(model).to.include('payloadJson');
        expect(model).to.include('primaryKey: true');
        expect(model).to.include("DataTypes.TEXT('long')");
    });

    it('runtime persistence no longer saves ScormCmiState directly', () => {
        const runtime = source('services/scorm/ScormRuntimeService.js');
        expect(runtime).to.include("require('./ScormRuntimeSnapshotStore')");
        expect(runtime).to.include('await RuntimeStore.save(reg.id, state)');
        expect(runtime).to.not.include('ScormCmiState');
        expect(runtime).to.not.include('await state.save()');
    });

    it('does not monkey-patch commit and drop its buffered values argument', () => {
        const server = source('index.js');
        expect(server).to.not.include('Runtime.commit =');
        expect(server).to.not.include('Runtime.finish =');
        expect(server).to.include('buffered `values` argument');
    });

    it('can decode the canonical state used by preview and learner tracking', () => {
        const state = RuntimeStore.snapshotState({
            payloadJson: JSON.stringify({
                lessonStatus: 'incomplete',
                scoreRaw: 70,
                lessonLocation: 'screen-4',
                totalTime: '00:03:12.00',
                rawMapJson: JSON.stringify({ 'cmi.progress_measure': '0.4' }),
                stateVersion: 7,
                initialized: true
            }),
            stateVersion: 7,
            initialized: true
        });
        expect(state.lessonStatus).to.equal('incomplete');
        expect(state.scoreRaw).to.equal(70);
        expect(state.lessonLocation).to.equal('screen-4');
        expect(state.stateVersion).to.equal(7);
        expect(state.initialized).to.equal(true);
    });

    it('keeps legacy CMI writes best-effort and asynchronous', () => {
        const store = source('services/scorm/ScormRuntimeSnapshotStore.js');
        expect(store).to.include('queueLegacyProjection');
        expect(store).to.include('setImmediate');
        expect(store).to.include('legacy CMI projection failed');
    });
});
