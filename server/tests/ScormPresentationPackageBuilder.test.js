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
        expect(html).to.not.include('--primary:#f97316');
        expect(html).to.include('object-fit:contain');
        expect(html).to.include('height:100dvh');
        expect(html).to.include('object-position:center center');
        expect(html).to.include('@media(max-width:720px) and (orientation:portrait)');
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
});
