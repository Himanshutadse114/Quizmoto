const { expect } = require('chai');
const JSZip = require('jszip');
const vm = require('vm');
const {
    buildPresentationScormZip,
    normalizeQuiz
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

    it('packages slide images, a theme-matched quiz and complete SCORM tracking', async () => {
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
        expect(html).to.include('--primary:#f97316');
        expect(html).to.include('object-fit:contain');
        expect(html).to.include('class="course-rail"');
        expect(html).to.include('grid-template-columns:clamp(184px,16vw,236px) minmax(0,1fr)');
        expect(html).to.include('id="presentation"');
        expect(html).to.include('root.requestFullscreen||root.webkitRequestFullscreen');
        expect(html).to.not.include('class="topbar"');
        expect(html).to.not.include('class="controls"');
        expect(html).to.include("cmi.core.lesson_location");
        expect(html).to.include("cmi.suspend_data");
        expect(html).to.include("cmi.core.score.raw");
        expect(html).to.include("cmi.interactions.");
        expect(html).to.include("cmi.core.lesson_status");
        expect(html).to.include('image.dataset.src=slide.src');
        expect(content.courseMode).to.equal('presentation');
        expect(content.generatedBy).to.equal('lmsgen-presentation-import');
        expect(content.quiz.questions).to.have.length(5);
        expect(content.passScore).to.equal(75);
        const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
            .map((match) => match[1].trim())
            .filter(Boolean);
        expect(scripts).to.have.length(1);
        expect(() => new vm.Script(scripts[0])).not.to.throw();
    });
});
