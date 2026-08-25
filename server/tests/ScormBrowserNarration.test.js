const { expect } = require('chai');
const JSZip = require('jszip');
const {
    BROWSER_NARRATION_SCRIPT_ID,
    browserNarrationScript,
    injectBrowserNarrationUi,
    addBrowserNarrationToZip
} = require('../services/scorm/ScormReplicateMediaFinalizer');

describe('SCORM browser narration', () => {
    it('adds a zero-API-cost Web Speech narration controller to learner HTML', () => {
        const source = '<html><head></head><body><header></header><main><section class="slide active"><h2>Safe payments</h2><p>Verify unexpected requests.</p></section></main></body></html>';
        const html = injectBrowserNarrationUi(source);
        expect(html).to.include(BROWSER_NARRATION_SCRIPT_ID);
        expect(html).to.include('speechSynthesis');
        expect(html).to.include('SpeechSynthesisUtterance');
        expect(html).to.include('qmx-narration-toggle');
        expect(html).to.include('/google/i');
        expect(html).to.include('Narration On');
        expect(html).to.not.include('🔊');
        expect(html).to.not.include('🔈');
    });

    it('does not inject narration more than once', () => {
        const source = '<html><body><header></header><main></main></body></html>';
        const once = injectBrowserNarrationUi(source);
        const twice = injectBrowserNarrationUi(once);
        expect((twice.match(new RegExp(BROWSER_NARRATION_SCRIPT_ID, 'g')) || []).length).to.equal(1);
    });

    it('keeps narration entirely inside the SCORM ZIP without adding audio files', async () => {
        const zip = new JSZip();
        zip.file('index.html', '<html><body><header></header><main></main></body></html>');
        zip.file('assets/media/course-cover.webp', Buffer.from('fake-image'));
        const input = await zip.generateAsync({ type: 'nodebuffer' });
        const output = await addBrowserNarrationToZip(input);
        const result = await JSZip.loadAsync(output);
        const html = await result.file('index.html').async('string');
        expect(html).to.include(BROWSER_NARRATION_SCRIPT_ID);
        expect(result.file('assets/media/course-cover.webp')).to.not.equal(null);
        expect(Object.keys(result.files).some((name) => /\.(mp3|wav|ogg)$/i.test(name))).to.equal(false);
    });

    it('prefers natural voices, waits for browser voices, and uses slower pacing', () => {
        const script = browserNarrationScript();
        expect(script).to.include("if (/natural|neural|premium|enhanced|online/i.test(name)) total += 140");
        expect(script).to.include("if (/google/i.test(name)) total += 90");
        expect(script).to.include("navigator.language || 'en-US'");
        expect(script).to.include("synth.addEventListener('voiceschanged'");
        expect(script).to.include('utterance.rate = 0.86');
        expect(script).to.include('utterance.pitch = 0.98');
    });

    it('shortens learning paragraphs before narration by roughly three visual lines', () => {
        const script = browserNarrationScript();
        expect(script).to.include('shortenLearningParagraphs');
        expect(script).to.include(".slide[data-kind=\"learning\"] .qmx-copy > p");
        expect(script).to.include('words.length >= 150 ? 42');
        expect(script).to.include("data-qmx-shortened");
    });
});
