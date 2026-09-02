const { expect } = require('chai');
const vm = require('vm');
const {
    RUNTIME_REPAIR_SCRIPT_ID,
    runtimeRepairScript,
    injectRuntimeRepair
} = require('../services/scorm/ScormRuntimeRepair');

function scriptBody(source) {
    return String(source)
        .replace(/^<script[^>]*>/, '')
        .replace(/<\/script>$/, '');
}

describe('SCORM runtime API repair', () => {
    it('re-acquires the parent API when it becomes available after package boot', () => {
        const parent = { API: null };
        parent.parent = parent;
        const child = { parent, opener: null };
        child.window = child;

        vm.runInNewContext(scriptBody(runtimeRepairScript()), { window: child });

        // This is the failure mode of the legacy generated wrapper: its first
        // lookup can happen before the LMS API is reachable. The repair must not
        // permanently cache that miss.
        expect(child.doLMSInitialize()).to.equal('false');

        const values = {};
        let commits = 0;
        parent.API = {
            LMSInitialize: () => 'true',
            LMSFinish: () => 'true',
            LMSGetValue: (name) => values[name] || '',
            LMSSetValue: (name, value) => { values[name] = value; return 'true'; },
            LMSCommit: () => { commits += 1; return 'true'; },
            LMSGetLastError: () => '0',
            LMSGetErrorString: () => 'No error',
            LMSGetDiagnostic: () => 'No error'
        };

        expect(child.doLMSInitialize()).to.equal('true');
        expect(child.doLMSSetValue('cmi.core.score.raw', '88')).to.equal('true');
        expect(child.doLMSGetValue('cmi.core.score.raw')).to.equal('88');
        expect(child.doLMSCommit()).to.equal('true');
        expect(commits).to.equal(1);
    });

    it('injects immediately after the generated wrapper and is idempotent', () => {
        const html = '<html><head><script src="scorm_api_wrapper.js"></script></head><body></body></html>';
        const once = injectRuntimeRepair(html);
        const twice = injectRuntimeRepair(once);
        expect(once).to.include(RUNTIME_REPAIR_SCRIPT_ID);
        expect(once.indexOf(RUNTIME_REPAIR_SCRIPT_ID)).to.be.greaterThan(once.indexOf('scorm_api_wrapper.js'));
        expect(twice).to.equal(once);
        expect((once.match(new RegExp(RUNTIME_REPAIR_SCRIPT_ID, 'g')) || []).length).to.equal(1);
    });
});
