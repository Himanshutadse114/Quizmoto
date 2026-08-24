const JSZip = require('jszip');
const { TEMPLATES } = require('./ScormVisualPackageBuilder');

const SCORM_WRAPPER = `var findAPITries=0;
function findAPI(win){while((win.API==null)&&(win.parent!=null)&&(win.parent!=win)){findAPITries++;if(findAPITries>500)return null;win=win.parent;}return win.API;}
function getAPI(){var a=findAPI(window);if((a==null)&&(window.opener!=null)){try{a=findAPI(window.opener);}catch(e){}}return a;}
var API=getAPI();
function doLMSInitialize(){if(!API)return "false";return API.LMSInitialize("");}
function doLMSFinish(){if(!API)return "false";return API.LMSFinish("");}
function doLMSGetValue(n){if(!API)return "";return API.LMSGetValue(n);}
function doLMSSetValue(n,v){if(!API)return "false";return API.LMSSetValue(n,v);}
function doLMSCommit(){if(!API)return "false";return API.LMSCommit("");}
`;

const VALID_LAYOUTS = new Set(['process', 'cards', 'timeline', 'comparison', 'hub', 'spotlight', 'matrix', 'cycle']);

function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeXml(value) {
    return escapeHtml(value).replace(/&#39;/g, '&apos;');
}

function isRasterPath(value) {
    const path = clean(value).toLowerCase();
    return /\.(webp|png|jpe?g)(?:$|[?#])/.test(path);
}

function normalizeLayout(value, index) {
    const layout = clean(value).toLowerCase();
    if (VALID_LAYOUTS.has(layout)) return layout;
    return ['cards', 'process', 'comparison', 'spotlight'][index % 4];
}

function normalizeCourse(rawAnalysis) {
    const analysis = rawAnalysis && typeof rawAnalysis === 'object' ? { ...rawAnalysis } : {};
    const slides = (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide, index) => {
        const item = slide && typeof slide === 'object' ? { ...slide } : {};
        const raster = isRasterPath(item.visualAsset)
            ? clean(item.visualAsset)
            : (isRasterPath(item.rasterVisualAsset) ? clean(item.rasterVisualAsset) : '');
        const keyPoints = (Array.isArray(item.keyPoints) ? item.keyPoints : [])
            .map(clean)
            .filter(Boolean)
            .slice(0, 4);
        return {
            ...item,
            title: clean(item.title) || `Section ${index + 1}`,
            content: clean(item.content || item.introText || item.revealText),
            keyPoints,
            layout: normalizeLayout(item.layout, index),
            visualTitle: clean(item.visualTitle || item.title) || `Section ${index + 1}`,
            visualAsset: raster || null,
            rasterVisualAsset: raster || null,
            mobileVisualAsset: raster || null,
            visualSource: raster ? 'ai_raster' : null,
            visualAssetType: raster ? 'image/webp' : null
        };
    });

    const cover = isRasterPath(analysis.coverVisualAsset)
        ? clean(analysis.coverVisualAsset)
        : (isRasterPath(analysis.coverImageAsset) ? clean(analysis.coverImageAsset) : '');

    return {
        ...analysis,
        title: clean(analysis.title) || 'Learning course',
        summary: clean(analysis.summary),
        slides,
        quiz: (Array.isArray(analysis.quiz) ? analysis.quiz : []).map((question) => ({
            ...(question || {}),
            question: clean(question?.question),
            options: (Array.isArray(question?.options) ? question.options : []).map(clean).slice(0, 4),
            correctAnswer: Number(question?.correctAnswer),
            explanation: clean(question?.explanation)
        })),
        visualMode: 'raster',
        visualProvider: 'replicate',
        coverImageAsset: cover || null,
        coverVisualAsset: cover || null,
        coverMobileVisualAsset: cover || null,
        experienceVersion: 7
    };
}

function mediaMap(mediaFiles) {
    const map = new Map();
    for (const file of Array.isArray(mediaFiles) ? mediaFiles : []) {
        const path = clean(file?.path);
        if (!path || !file?.body) continue;
        map.set(path, file);
    }
    return map;
}

function canonicalRasterPaths(analysis) {
    const paths = [];
    if (analysis.coverVisualAsset) paths.push(analysis.coverVisualAsset);
    for (const slide of analysis.slides || []) {
        if (slide?.visualAsset) paths.push(slide.visualAsset);
    }
    return Array.from(new Set(paths));
}

function validateRasterMappings(analysis, mediaFiles) {
    const map = mediaMap(mediaFiles);
    if (!analysis.coverVisualAsset || !isRasterPath(analysis.coverVisualAsset)) {
        const err = new Error('Canonical raster course requires a generated cover image.');
        err.code = 'SCORM_RASTER_MAPPING_INVALID';
        throw err;
    }

    const referenced = new Set(canonicalRasterPaths(analysis));
    const missing = Array.from(referenced).filter((path) => !map.has(path));
    if (missing.length) {
        const err = new Error(`Canonical raster course references image files that are not packaged: ${missing.join(', ')}`);
        err.code = 'SCORM_RASTER_MAPPING_INVALID';
        err.missingPaths = missing;
        throw err;
    }

    const generatedRasterPaths = Array.from(map.keys()).filter((path) => isRasterPath(path));
    const unused = generatedRasterPaths.filter((path) => !referenced.has(path));
    if (unused.length) {
        const err = new Error(`Generated course images are not mapped to learner slides: ${unused.join(', ')}`);
        err.code = 'SCORM_RASTER_UNMAPPED_MEDIA';
        err.unusedPaths = unused;
        throw err;
    }

    const duplicated = new Map();
    for (const [index, slide] of (analysis.slides || []).entries()) {
        if (!slide?.visualAsset) continue;
        const owners = duplicated.get(slide.visualAsset) || [];
        owners.push(index + 1);
        duplicated.set(slide.visualAsset, owners);
    }
    const reused = Array.from(duplicated.entries()).filter(([, owners]) => owners.length > 1);
    if (reused.length) {
        const err = new Error(`A generated image is mapped to more than one learning slide: ${reused.map(([path, owners]) => `${path} -> slides ${owners.join(',')}`).join(' | ')}`);
        err.code = 'SCORM_RASTER_DUPLICATE_MAPPING';
        throw err;
    }

    return {
        referencedPaths: Array.from(referenced),
        generatedPaths: generatedRasterPaths,
        mappedSlideCount: (analysis.slides || []).filter((slide) => Boolean(slide?.visualAsset)).length
    };
}

function themeFor(templateId) {
    return TEMPLATES[templateId] || TEMPLATES[1] || {
        primary: '#177E78', primaryDark: '#12635f', accent: '#4FC9BF', bg: '#E7E7E4',
        surface: '#FFFFFF', text: '#282824', muted: '#5F625D', soft: '#DDEBE8'
    };
}

function renderImage(path, alt, className = 'course-image') {
    if (!path) return '';
    return `<figure class="${className}" data-raster-path="${escapeHtml(path)}"><img src="${escapeHtml(path)}" alt="${escapeHtml(alt || 'Learning visual')}" loading="eager" decoding="async"></figure>`;
}

function renderPointCards(slide) {
    const points = (slide.keyPoints || []).slice(0, 4);
    if (!points.length) return '';
    return `<div class="point-grid point-grid--${escapeHtml(slide.layout)}">${points.map((point, index) => `
        <div class="point-card">
            <span class="point-index">${String(index + 1).padStart(2, '0')}</span>
            <p>${escapeHtml(point)}</p>
        </div>`).join('')}</div>`;
}

function renderLearningSlide(slide, index) {
    const hasImage = Boolean(slide.visualAsset);
    const image = hasImage ? renderImage(slide.visualAsset, slide.visualTitle || slide.title, 'course-image course-image--slide') : '';
    const cards = renderPointCards(slide);
    return `<section class="slide learning-slide${hasImage ? ' learning-slide--image' : ' learning-slide--text'}" data-kind="learning" data-learning-index="${index}" aria-hidden="true">
        <div class="stage learning-stage${hasImage ? ' learning-stage--with-image' : ''}">
            <div class="learning-copy">
                <div class="eyebrow">Section ${index + 1}</div>
                <h2 class="title">${escapeHtml(slide.title)}</h2>
                <p class="lead">${escapeHtml(slide.content)}</p>
                ${cards}
            </div>
            ${image}
        </div>
    </section>`;
}

function renderQuizSlide(question, index) {
    const options = (question.options || []).slice(0, 4);
    return `<section class="slide quiz-slide" data-kind="quiz" data-quiz-index="${index}" aria-hidden="true">
        <div class="stage quiz-stage">
            <div class="quiz-card">
                <div class="eyebrow">Knowledge Check ${index + 1}</div>
                <h2 class="quiz-title">${escapeHtml(question.question)}</h2>
                <div class="quiz-options" id="opts-${index}">
                    ${options.map((option, optionIndex) => `<button class="quiz-option" type="button" data-qi="${index}" data-oi="${optionIndex}">${escapeHtml(option)}</button>`).join('')}
                </div>
                <div class="feedback" id="fb-${index}" role="status" aria-live="polite"><strong class="feedback-status"></strong><span class="feedback-explanation"></span></div>
            </div>
        </div>
    </section>`;
}

function renderPlayerHtml(analysis, theme, logoHtml) {
    const safeData = JSON.stringify({
        title: analysis.title,
        quiz: analysis.quiz
    }).replace(/</g, '\\u003c');
    const cover = renderImage(analysis.coverVisualAsset, analysis.title, 'course-image course-image--cover');
    const learning = analysis.slides.map(renderLearningSlide).join('\n');
    const quizzes = analysis.quiz.map(renderQuizSlide).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="generator" content="Quizmoto Canonical Raster Course V7">
<meta name="quizmoto-raster-canonical" content="1">
<title>${escapeHtml(analysis.title)}</title>
<script src="scorm_api_wrapper.js"></script>
<style>
:root{--primary:${theme.primary};--primary-dark:${theme.primaryDark};--accent:${theme.accent};--bg:#E7E7E4;--paper:#F4F3EF;--surface:#FFFFFF;--text:#282824;--muted:#5A5C56;--line:#CBC5B8;--soft:${theme.soft || '#DDEBE8'};--shadow:0 18px 48px rgba(40,40,36,.08)}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit}
#app{height:100%;display:flex;flex-direction:column;background:var(--bg)}
header{height:62px;display:flex;align-items:center;gap:13px;padding:0 24px;border-bottom:1px solid var(--line);background:rgba(231,231,228,.96);z-index:5}.brand-mark{width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:var(--text);color:#fff;font-weight:900}.brand-logo{height:36px;max-width:150px;object-fit:contain}header h1{margin:0;max-width:38vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:800}.progress-shell{margin-left:auto;width:min(330px,28vw);height:5px;background:var(--line);border-radius:99px;overflow:hidden}.progress-fill{height:100%;width:0;background:var(--text);transition:width .2s ease}.progress-text{min-width:36px;font-size:10px;font-weight:800;color:var(--muted);text-align:right}
main{position:relative;flex:1;min-height:0}.slide{position:absolute;inset:0;display:none;overflow:auto;padding:28px 34px}.slide.active{display:flex;align-items:center;justify-content:center}.stage{width:min(1180px,100%);margin:auto}.eyebrow{margin-bottom:10px;color:var(--primary-dark);font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.title{margin:0 0 16px;font-size:clamp(30px,4vw,52px);line-height:1.05;letter-spacing:-.04em}.lead{margin:0;color:var(--muted);font-size:16px;line-height:1.62}
.cover-stage{display:grid;grid-template-columns:minmax(0,.9fr) minmax(420px,1.1fr);gap:42px;align-items:center}.cover-copy{min-width:0}.cover-copy .title{font-size:clamp(38px,5vw,62px)}.cover-copy .lead{font-size:17px}.cover-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.meta-chip{padding:7px 10px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.35);font-size:10px;font-weight:800;color:var(--muted)}
.course-image{margin:0;width:100%;aspect-ratio:16/9;border-radius:22px;overflow:hidden;background:#D8D8D2;border:1px solid var(--line);box-shadow:var(--shadow)}.course-image img{display:block;width:100%;height:100%;object-fit:cover}.course-image--cover{align-self:center}.course-image--slide{align-self:center}
.learning-stage{display:block}.learning-stage--with-image{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);gap:32px;align-items:center}.learning-copy{min-width:0}.learning-copy .title{font-size:clamp(30px,3.5vw,46px)}.point-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:22px}.point-card{min-height:82px;padding:14px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.28)}.point-index{display:block;margin-bottom:7px;font-size:9px;font-weight:900;letter-spacing:.12em;color:var(--primary-dark)}.point-card p{margin:0;font-size:12.5px;line-height:1.45;font-weight:700;color:#444740}.point-grid--process .point-card,.point-grid--timeline .point-card,.point-grid--cycle .point-card{border-left:4px solid var(--primary)}.point-grid--comparison .point-card:nth-child(odd){background:rgba(222,235,226,.55)}.point-grid--comparison .point-card:nth-child(even){background:rgba(239,224,220,.55)}
.quiz-stage{width:min(900px,100%)}.quiz-card{padding:34px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.42)}.quiz-title{margin:0;font-size:clamp(27px,3vw,40px);line-height:1.12;letter-spacing:-.025em}.quiz-options{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:24px}.quiz-option{min-height:60px;padding:14px 16px;text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--paper);color:var(--text);font-weight:700;cursor:pointer}.quiz-option:hover:not(:disabled){background:#FCF2B5}.quiz-option.correct{border-color:#72917B;background:#DFE9E1;color:#274A31}.quiz-option.incorrect{border-color:#B9786B;background:#EFE0DC;color:#713A31}.feedback{display:none;margin-top:14px;padding:14px 15px;border:1px solid var(--line);border-radius:10px;background:var(--paper);font-size:13px;line-height:1.55;color:var(--muted)}.feedback.show{display:block}.feedback-status{display:block;margin-bottom:5px;color:var(--text)}.feedback-explanation{display:block}
.final-stage{width:min(700px,100%);text-align:center}.final-card{padding:42px 36px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.4)}.score{margin:22px auto 28px;font-size:54px;font-weight:950;letter-spacing:-.04em}.finish-btn{min-width:190px}
footer{height:66px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-top:1px solid var(--line);background:rgba(231,231,228,.96);z-index:5}.nav-btn{min-height:42px;padding:9px 16px;border-radius:9px;border:1px solid var(--line);font-weight:800;cursor:pointer}.nav-btn.primary{background:var(--text);color:#fff;border-color:var(--text)}.nav-btn.secondary{background:transparent;color:var(--text)}.nav-btn:disabled{opacity:.35;cursor:not-allowed}.slide-number{font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.04em}
@media(max-width:980px){.cover-stage,.learning-stage--with-image{grid-template-columns:1fr}.course-image--cover,.course-image--slide{width:min(720px,100%);margin:0 auto}.cover-copy{text-align:center}.cover-meta{justify-content:center}.quiz-options{grid-template-columns:1fr}.slide{padding:22px 20px}}
@media(max-width:560px){header{height:56px;padding:0 12px}header h1{max-width:34vw}.progress-shell{width:24vw}.slide{padding:16px 12px}.course-image{border-radius:14px}.point-grid{grid-template-columns:1fr}.quiz-card,.final-card{padding:24px 18px}footer{height:62px;padding:0 12px}.nav-btn{font-size:12px}.cover-copy .title{font-size:34px}.lead{font-size:14px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body>
<div id="app">
<header>${logoHtml || '<div class="brand-mark">Q</div>'}<h1>${escapeHtml(analysis.title)}</h1><div class="progress-shell"><div id="progress-fill" class="progress-fill"></div></div><span id="progress-text" class="progress-text">0%</span></header>
<main id="content-area">
<section class="slide cover-slide active" data-kind="cover" aria-hidden="false">
    <div class="stage cover-stage">
        <div class="cover-copy">
            <div class="eyebrow">Quizmoto Learning Experience</div>
            <h1 class="title">${escapeHtml(analysis.title)}</h1>
            <p class="lead">${escapeHtml(analysis.summary)}</p>
            <div class="cover-meta"><span class="meta-chip">${analysis.slides.length} learning sections</span><span class="meta-chip">${analysis.quiz.length} knowledge checks</span><span class="meta-chip">Self-paced SCORM 1.2</span></div>
        </div>
        ${cover}
    </div>
</section>
${learning}
${quizzes}
<section class="slide final-slide" data-kind="final" aria-hidden="true"><div class="stage final-stage"><div class="final-card"><div class="eyebrow">Course Complete</div><h2 class="title">Well done</h2><p class="lead">Your answers have been evaluated. Finish the course to save your completion.</p><div id="final-score" class="score">--%</div><button id="finish-btn" class="nav-btn primary finish-btn" type="button">Finish Course</button></div></div></section>
</main>
<footer><button id="prev-btn" class="nav-btn secondary" type="button">Previous</button><div id="slide-number" class="slide-number">Part 1</div><button id="next-btn" class="nav-btn primary" type="button">Next</button></footer>
</div>
<script>
(function(){
var DATA=${safeData};
var current=0,answered={},completed=false,sessionStart=Date.now(),commitTimer=null;
function byId(id){return document.getElementById(id)}
function slides(){return Array.prototype.slice.call(document.querySelectorAll('.slide'))}
function lmsSet(k,v){try{if(typeof doLMSSetValue==='function')return doLMSSetValue(k,String(v==null?'':v))}catch(e){}return 'false'}
function lmsGet(k){try{if(typeof doLMSGetValue==='function')return String(doLMSGetValue(k)||'')}catch(e){}return ''}
function lmsCommit(){try{if(typeof doLMSCommit==='function')doLMSCommit()}catch(e){}}
function sessionTime(ms){var total=Math.max(0,Math.floor(ms/1000)),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;function p(n,l){var v=String(n);while(v.length<l)v='0'+v;return v}return p(h,4)+':'+p(m,2)+':'+p(s,2)+'.00'}
function saveProgress(){lmsSet('cmi.core.session_time',sessionTime(Date.now()-sessionStart));lmsSet('cmi.core.lesson_location',current);lmsCommit()}
function score(){var total=(DATA.quiz||[]).length;if(!total)return 100;var hits=0;(DATA.quiz||[]).forEach(function(q,i){if(answered[i]===Number(q.correctAnswer))hits++});return Math.round(hits/total*100)}
function updateScore(){var node=byId('final-score');if(node)node.textContent=score()+'%'}
function show(index){var all=slides();if(!all.length)return;current=Math.max(0,Math.min(all.length-1,index));all.forEach(function(node,i){var active=i===current;node.classList.toggle('active',active);node.setAttribute('aria-hidden',active?'false':'true')});var pct=Math.round(current/Math.max(1,all.length-1)*100);byId('progress-fill').style.width=pct+'%';byId('progress-text').textContent=pct+'%';byId('slide-number').textContent='Part '+(current+1)+' of '+all.length;byId('prev-btn').disabled=current===0;var next=byId('next-btn');if(current===all.length-1){next.style.display='none';updateScore()}else{next.style.display='inline-flex';next.textContent=current===all.length-2?'Finish':'Next'}saveProgress()}
function recordInteraction(qi,oi,q){var options=Array.isArray(q.options)?q.options:[],correct=Number(q.correctAnswer);lmsSet('quizmoto.quiz.count',(DATA.quiz||[]).length);lmsSet('quizmoto.quiz.'+qi+'.question',q.question||'');lmsSet('quizmoto.quiz.'+qi+'.selected',options[oi]||'');lmsSet('quizmoto.quiz.'+qi+'.correct',options[correct]||'');lmsSet('quizmoto.quiz.'+qi+'.selected_index',oi);lmsSet('quizmoto.quiz.'+qi+'.correct_index',correct);lmsSet('quizmoto.quiz.'+qi+'.result',oi===correct?'correct':'incorrect');lmsSet('quizmoto.quiz.'+qi+'.explanation',q.explanation||'');lmsSet('cmi.interactions.'+qi+'.id','scorm_ai_question_'+(qi+1));lmsSet('cmi.interactions.'+qi+'.type','choice');lmsSet('cmi.interactions.'+qi+'.student_response',oi);lmsSet('cmi.interactions.'+qi+'.correct_responses.0.pattern',correct);lmsSet('cmi.interactions.'+qi+'.result',oi===correct?'correct':'wrong');lmsCommit()}
function answer(button){var qi=Number(button.getAttribute('data-qi')),oi=Number(button.getAttribute('data-oi'));if(!Number.isInteger(qi)||!Number.isInteger(oi)||answered[qi]!==undefined)return;var q=(DATA.quiz||[])[qi];if(!q)return;answered[qi]=oi;var correct=Number(q.correctAnswer),container=byId('opts-'+qi);if(container){container.querySelectorAll('.quiz-option').forEach(function(btn,index){btn.disabled=true;if(index===correct)btn.classList.add('correct');else if(index===oi)btn.classList.add('incorrect')})}var feedback=byId('fb-'+qi);if(feedback){feedback.classList.add('show');var status=feedback.querySelector('.feedback-status'),explanation=feedback.querySelector('.feedback-explanation');if(status)status.textContent=oi===correct?'Correct':'Not quite';if(explanation)explanation.textContent=q.explanation||'Review the correct answer before continuing.'}recordInteraction(qi,oi,q)}
function finish(){if(completed)return;var finalScore=score();lmsSet('cmi.core.score.raw',finalScore);lmsSet('cmi.core.score.min','0');lmsSet('cmi.core.score.max','100');lmsSet('cmi.core.lesson_status',finalScore>=70?'passed':'completed');lmsSet('cmi.core.exit','');lmsSet('cmi.core.session_time',sessionTime(Date.now()-sessionStart));lmsCommit();try{if(typeof doLMSFinish==='function')doLMSFinish()}catch(e){}completed=true;if(commitTimer){clearInterval(commitTimer);commitTimer=null}try{if(window.opener)window.opener.postMessage({type:'quizmoto_scorm_exit'},'*')}catch(e){}try{window.close()}catch(e){}}
function init(){try{if(typeof doLMSInitialize==='function')doLMSInitialize()}catch(e){}var status=lmsGet('cmi.core.lesson_status');if(!status||status==='not attempted')lmsSet('cmi.core.lesson_status','incomplete');lmsSet('cmi.core.score.min','0');lmsSet('cmi.core.score.max','100');var saved=parseInt(lmsGet('cmi.core.lesson_location'),10);if(!Number.isFinite(saved))saved=0;document.querySelectorAll('.quiz-option').forEach(function(btn){btn.addEventListener('click',function(){answer(btn)})});byId('prev-btn').addEventListener('click',function(){show(current-1)});byId('next-btn').addEventListener('click',function(){show(current+1)});byId('finish-btn').addEventListener('click',finish);show(saved);commitTimer=setInterval(function(){if(!completed)saveProgress()},15000)}
window.addEventListener('beforeunload',function(){if(completed)return;lmsSet('cmi.core.exit','suspend');saveProgress()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>
</body>
</html>`;
}

function validateHtmlImageCoverage(html, expectedPaths) {
    const missing = (expectedPaths || []).filter((path) => !String(html || '').includes(`src="${escapeHtml(path)}"`));
    if (missing.length) {
        const err = new Error(`Generated images are packaged but missing from learner HTML: ${missing.join(', ')}`);
        err.code = 'SCORM_RASTER_HTML_COVERAGE_FAILED';
        err.missingPaths = missing;
        throw err;
    }
    return true;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const analysis = normalizeCourse(rawAnalysis);
    const mediaFiles = Array.isArray(opts.replicateMediaFiles) ? opts.replicateMediaFiles : [];
    const validation = validateRasterMappings(analysis, mediaFiles);
    const zip = new JSZip();
    const theme = themeFor(opts.templateId || analysis.themeId || 1);

    let logoFileName = '';
    let logoHtml = '';
    if (opts.logoDataUrl) {
        const match = String(opts.logoDataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
            const ext = match[1].split('/')[1].split('+')[0];
            logoFileName = `logo.${ext}`;
            zip.file(logoFileName, match[2], { base64: true });
            logoHtml = `<img class="brand-logo" src="${logoFileName}" alt="Logo">`;
        }
    }

    const html = renderPlayerHtml(analysis, theme, logoHtml);
    validateHtmlImageCoverage(html, validation.referencedPaths);

    for (const file of mediaFiles) {
        if (file?.path && file?.body) zip.file(clean(file.path), file.body);
    }
    zip.file('index.html', html);
    zip.file('scorm_api_wrapper.js', SCORM_WRAPPER);
    zip.file('content.json', JSON.stringify({
        ...analysis,
        generatedBy: 'quizmoto',
        generator: 'Quizmoto Canonical Raster Course V7',
        version: 7,
        experienceVersion: 7,
        visualEngine: 'canonical-direct-webp',
        canonicalRasterVisuals: true,
        legacySvgFallback: false,
        runtimeRasterInjection: false,
        generatedRasterPaths: validation.generatedPaths,
        renderedRasterPaths: validation.referencedPaths,
        mappedSlideImageCount: validation.mappedSlideCount
    }, null, 2));

    const mediaEntries = validation.generatedPaths.map((path) => `      <file href="${escapeXml(path)}"/>`).join('\n');
    const logoEntry = logoFileName ? `\n      <file href="${escapeXml(logoFileName)}"/>` : '';
    const title = escapeXml(analysis.title);
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.quizmoto.canonical.${Date.now()}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-1"><organization identifier="ORG-1"><title>${title}</title><item identifier="ITEM-1" identifierref="RES-1"><title>${title}</title></item></organization></organizations>
  <resources><resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm_api_wrapper.js"/>
      <file href="content.json"/>
${mediaEntries}${logoEntry}
  </resource></resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
    buildScormPackageZip,
    renderPlayerHtml,
    normalizeCourse,
    validateRasterMappings,
    validateHtmlImageCoverage,
    canonicalRasterPaths,
    isRasterPath,
    renderLearningSlide,
    renderQuizSlide,
    renderPointCards,
    SCORM_WRAPPER
};
