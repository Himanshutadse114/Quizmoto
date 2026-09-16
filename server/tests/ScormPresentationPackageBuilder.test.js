const { expect } = require('chai');
const JSZip = require('jszip');
const vm = require('vm');
const {
    buildPresentationScormZip,
    normalizeQuiz,
    normalizeTheme,
    QUIZMOTO_PRESENTATION_THEME
} = require('../services/scorm/ScormPresentationPackageBuilder');

function quiz() {
    return {
        title: 'Deck Check',
        questions: Array.from({ length: 5 }, (_, index) => ({
            questionText: `Question ${index + 1}?`,
            options: ['First', 'Second', 'Third', 'Fourth'],
            correctIndex: index % 4,
            explanation: 'The deck explains this answer.'
        }))
    };
}

describe('ScormPresentationPackageBuilder', () => {
    it('maps generated quiz questions into the presentation player format', () => {
        const normalized = normalizeQuiz(quiz());
        expect(normalized.questions).to.have.length(5);
        expect(normalized.questions[0]).to.include({
            id: 'question_1',
            question: 'Question 1?',
            correctAnswer: 0
        });
    });

    it('always applies the Quizmoto teal presentation theme', () => {
        expect(normalizeTheme({ primary: '#ff0000', background: '#ffffff' }))
            .to.deep.equal(QUIZMOTO_PRESENTATION_THEME);
    });

    it('packages slide images, a Quizmoto-themed quiz and complete SCORM tracking', async () => {
        const slides = [1, 2].map((number) => ({
            path: `slides/slide-00${number}.webp`,
            body: Buffer.from(`slide-${number}`),
            width: 1600,
            height: 900
        }));
        const zipBuffer = await buildPresentationScormZip({
            title: 'Imported Deck',
            slides,
            quiz: quiz(),
            theme: {
                background: '#102a43',
                surface: '#173f5f',
                primary: '#f97316',
                secondary: '#facc15',
                text: '#ffffff',
                muted: '#cbd5e1',
                primaryText: '#111827',
                mode: 'dark'
            },
            passScore: 75
        });
        const zip = await JSZip.loadAsync(zipBuffer);
        const manifest = await zip.file('imsmanifest.xml').async('string');
        const html = await zip.file('index.html').async('string');
        const content = JSON.parse(await zip.file('content.json').async('string'));

        expect(zip.file('slides/slide-001.webp')).to.not.equal(null);
        expect(zip.file('slides/slide-002.webp')).to.not.equal(null);
        expect(manifest).to.include('adlcp:scormtype="sco"');
        expect(manifest).to.include('slides/slide-001.webp');
        expect(html).to.include('--primary:#147d75');
        expect(html).to.include('--background:#eef8f6');
        expect(html).to.include('--surface:#ffffff');
        expect(html).to.include('font-family:"Open Sauce Sans"');
        expect(html).to.include('font-weight:500;line-height:1.4');
        expect(html).to.not.include('font-weight:750;line-height:1.35');
        expect(content.playerFont).to.equal('Open Sauce Sans');
        expect(zip.file('assets/fonts/OpenSauceSans-Regular.woff2')).to.not.equal(null);
        expect(zip.file('assets/fonts/OpenSauce-SemiBold.woff2')).to.not.equal(null);
        expect(html).to.not.include('--primary:#f97316');
        expect(html).to.include('object-fit:contain');
        expect(html).to.include('height:100dvh');
        expect(html).to.include('object-position:center center');
        expect(html).to.include('@media(max-width:720px) and (orientation:portrait)');
        expect(html).to.include('.quiz-card,.result-card{width:min(480px,100%);border-radius:16px;padding:16px}');
        expect(html).to.include('.option{min-height:44px;padding:9px 11px;border-width:1px');
        expect(html).to.include('@media(max-width:380px) and (orientation:portrait)');
        expect(html).to.include('.rail-heading{display:none}');
        expect(html).to.include('class="course-rail"');
        expect(html).to.include('--rail-width:clamp(168px,13vw,220px)');
        expect(html).to.include('grid-template-columns:var(--rail-width) minmax(0,1fr)');
        expect(html).to.include('function fitRailToViewport()');
        expect(html).to.include('id="presentation"');
        expect(html).to.include('root.requestFullscreen||root.webkitRequestFullscreen');
        expect(html).to.not.include('class="topbar"');
        expect(html).to.not.include('class="controls"');
        expect(html).to.include("cmi.core.lesson_location");
        expect(html).to.include("cmi.suspend_data");
        expect(html).to.include("cmi.core.score.raw");
        expect(html).to.include("cmi.interactions.");
        expect(html).to.include("'Slide '+(index+1)+' viewing time'");
        expect(html).to.include("'quizmoto.slide_time.'+index+'.milliseconds'");
        expect(html).to.include('slideTimesMs');
        expect(html).to.include('interactionDuration(milliseconds)');
        expect(html).to.include("document.addEventListener('visibilitychange'");
        expect(html).to.include('pageTimingActive=false');
        expect(html).to.include("cmi.core.lesson_status");
        expect(html).to.include('image.dataset.src=slide.src');
        expect(content.courseMode).to.equal('presentation');
        expect(content.generatedBy).to.equal('lmsgen-presentation-import');
        expect(content.quiz.questions).to.have.length(5);
        expect(content.passScore).to.equal(75);
        expect(content.theme).to.deep.equal(QUIZMOTO_PRESENTATION_THEME);
        expect(html).to.match(/slides\/slide-001\.webp\?v=[0-9a-f]{12}/);
        const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
            .map((match) => match[1].trim())
            .filter(Boolean);
        expect(scripts).to.have.length(1);
        expect(() => new vm.Script(scripts[0])).not.to.throw();
    });

    it('embeds a custom logo in place of the presentation course label', async () => {
        const logoDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
        const zipBuffer = await buildPresentationScormZip({
            title: 'Branded Deck',
            slides: [{
                path: 'slides/slide-001.webp',
                body: Buffer.from('slide-1'),
                width: 1600,
                height: 900
            }],
            quiz: quiz(),
            logoDataUrl
        });
        const zip = await JSZip.loadAsync(zipBuffer);
        const html = await zip.file('index.html').async('string');
        const manifest = await zip.file('imsmanifest.xml').async('string');
        const content = JSON.parse(await zip.file('content.json').async('string'));

        expect(zip.file('assets/course-logo.png')).to.not.equal(null);
        expect(html).to.include('<img class="rail-logo" src="assets/course-logo.png" alt="Course logo">');
        expect(html).to.not.include('<span class="rail-kicker">Presentation course</span>');
        expect(manifest).to.include('<file href="assets/course-logo.png"/>');
        expect(content.branding.logoPath).to.equal('assets/course-logo.png');
    });
});
