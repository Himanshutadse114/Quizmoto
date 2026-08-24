const JSZip = require('jszip');
const { TEMPLATES, escapeXML } = require('./ScormVisualPackageBuilder');

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

function text(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function html(value) {
    return text(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isRasterPath(value) {
    const path = text(value).toLowerCase();
    return /\.(webp|png|jpe?g)(?:$|[?#])/.test(path) || /^data:image\/(?:webp|png|jpeg)/.test(path);
}

function rasterPath(slide) {
    const candidate = text(slide?.visualAsset || slide?.rasterVisualAsset || slide?.mobileVisualAsset);
    return isRasterPath(candidate) ? candidate : '';
}

function coverPath(analysis) {
    const candidate = text(analysis?.coverVisualAsset || analysis?.coverImageAsset || analysis?.coverMobileVisualAsset);
    return isRasterPath(candidate) ? candidate : '';
}

function keyPoints(slide, limit = 4) {
    const seen = new Set();
    return (Array.isArray(slide?.keyPoints) ? slide.keyPoints : [])
        .map(text)
        .filter(Boolean)
        .filter((item) => {
            const key = item.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, limit);
}

function imageFigure(path, alt, extraClass = '') {
    if (!path) return '';
    return `<figure class="qmx-native-media ${extraClass}"><img src="${html(path)}" alt="${html(alt || 'Learning visual')}" loading="eager" decoding="async"></figure>`;
}

function renderPoints(slide) {
    const points = keyPoints(slide, 4);
    if (!points.length) return '';
    const layout = text(slide?.layout).toLowerCase();
    if (layout === 'process' || layout === 'timeline' || layout === 'cycle') {
        return `<div class="qmx-process">${points.map((point, index) => `<div class="qmx-step"><span>${String(index + 1).padStart(2, '0')}</span><p>${html(point)}</p></div>`).join('')}</div>`;
    }
    if (layout === 'comparison') {
        const split = Math.max(1, Math.ceil(points.length / 2));
        const left = points.slice(0, split);
        const right = points.slice(split);
        return `<div class="qmx-compare"><div class="qmx-compare-col"><b>Consider</b>${left.map((point) => `<p>${html(point)}</p>`).join('')}</div><div class="qmx-compare-col qmx-compare-accent"><b>Apply</b>${(right.length ? right : left.slice(-1)).map((point) => `<p>${html(point)}</p>`).join('')}</div></div>`;
    }
    return `<div class="qmx-cards">${points.map((point, index) => `<div class="qmx-card"><span>${String(index + 1).padStart(2, '0')}</span><p>${html(point)}</p></div>`).join('')}</div>`;
}

function renderCover(analysis) {
    const path = coverPath(analysis);
    return `<section class="slide active" data-kind="cover">
      <div class="qmx-cover-shell">
        <div class="qmx-copy qmx-cover-copy">
          <div class="eyebrow">Quizmoto Learning Experience</div>
          <h2>${html(analysis?.title || 'Learning course')}</h2>
          <p>${html(analysis?.summary || '')}</p>
          <div class="qmx-meta"><span>Self-paced learning</span><span>${(analysis?.slides || []).length} learning sections</span><span>${(analysis?.quiz || []).length} knowledge checks</span></div>
        </div>
        ${imageFigure(path, analysis?.title || 'Course cover', 'qmx-cover-image')}
      </div>
    </section>`;
}

function renderLearningSlide(slide, index) {
    const path = rasterPath(slide);
    const points = renderPoints(slide);
    const visual = path ? imageFigure(path, slide?.visualTitle || slide?.title || `Section ${index + 1}`) : '';
    return `<section class="slide" data-kind="learning" data-section="${index + 1}">
      <div class="qmx-learning-shell ${path ? 'has-image' : 'no-image'}">
        <div class="qmx-copy">
          <div class="eyebrow">Section ${index + 1}</div>
          <h2>${html(slide?.title || `Section ${index + 1}`)}</h2>
          <p>${html(slide?.content || '')}</p>
          ${points}
        </div>
        ${visual}
      </div>
    </section>`;
}

function renderQuiz(question, index) {
    const options = (Array.isArray(question?.options) ? question.options : []).slice(0, 4);
    return `<section class="slide" data-kind="quiz" data-quiz-index="${index}">
      <div class="qmx-quiz-shell">
        <div class="eyebrow">Knowledge Check ${index + 1}</div>
        <h2>${html(question?.question || `Question ${index + 1}`)}</h2>
        <div class="qmx-options">${options.map((option, optionIndex) => `<button type="button" class="quiz-option" data-qi="${index}" data-oi="${optionIndex}">${html(option)}</button>`).join('')}</div>
        <div id="fb-${index}" class="feedback" aria-live="polite"></div>
      </div>
    </section>`;
}

function renderFinal() {
    return `<section class="slide" data-kind="final"><div class="qmx-final-shell"><div class="eyebrow">Course Complete</div><h2>Well done</h2><p>Your responses have been evaluated. Finish the course to save completion and score.</p><div class="qmx-score"><span id="final-res">--%</span></div><button id="finish-btn" type="button" class="nav-btn primary">Finish Course</button></div></section>`;
}

function playerCss(theme) {
    return `
:root{--primary:${theme.primary};--primary-dark:${theme.primaryDark};--accent:${theme.accent};--paper:#E7E7E4;--paper-2:#E5DFD2;--paper-3:#CBC5B8;--ink:#282824;--ink-soft:#4A4A45;--highlight:#FCF2B5;--white:#fff}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--paper);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit}#app{height:100%;display:flex;flex-direction:column;background:var(--paper)}
header{height:60px;display:flex;align-items:center;gap:14px;padding:0 26px;border-bottom:1px solid var(--paper-3);background:rgba(231,231,228,.96);z-index:10}.brand-mark{width:34px;height:34px;border-radius:8px;background:var(--ink);color:#fff;display:grid;place-items:center;font-weight:900}header h1{font-size:13px;margin:0;font-weight:800;max-width:36vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.progress-shell{height:5px;background:var(--paper-3);border-radius:999px;overflow:hidden;flex:1;margin-left:auto;max-width:360px}.progress-fill{height:100%;width:0;background:var(--ink);transition:width .25s ease}.progress-text{font-size:11px;font-weight:800;color:var(--ink-soft)}
main{position:relative;flex:1;overflow:hidden}.slide{position:absolute;inset:0;display:none;padding:28px 34px;overflow:auto}.slide.active{display:flex;align-items:center;justify-content:center}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#177E78;margin-bottom:10px}.qmx-copy h2,.qmx-quiz-shell h2,.qmx-final-shell h2{margin:0 0 16px;font-size:clamp(32px,4vw,52px);line-height:1.04;letter-spacing:-.04em;color:var(--ink)}.qmx-copy>p,.qmx-final-shell>p{margin:0;color:var(--ink-soft);font-size:16px;line-height:1.6}.qmx-copy>p{max-width:840px}
.qmx-cover-shell,.qmx-learning-shell,.qmx-quiz-shell,.qmx-final-shell{width:min(1180px,100%);margin:auto}.qmx-cover-shell{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);gap:34px;align-items:center;padding:34px;border:1px solid var(--paper-3);border-radius:18px;background:rgba(255,255,255,.22)}.qmx-cover-copy h2{font-size:clamp(38px,4.8vw,62px)}.qmx-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}.qmx-meta span{padding:7px 10px;border:1px solid var(--paper-3);border-radius:999px;font-size:10px;font-weight:800;color:var(--ink-soft);background:rgba(255,255,255,.24)}
.qmx-learning-shell{display:grid;grid-template-columns:1fr;gap:26px;align-items:start}.qmx-learning-shell.has-image{grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);align-items:center}.qmx-learning-shell.has-image .qmx-copy{min-width:0}.qmx-native-media{margin:0;width:100%;aspect-ratio:16/9;border-radius:20px;overflow:hidden;border:1px solid var(--paper-3);background:#d8d8d2;box-shadow:0 16px 38px rgba(40,40,36,.10)}.qmx-native-media img{display:block;width:100%;height:100%;object-fit:cover}.qmx-cover-image{align-self:center}
.qmx-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:22px}.qmx-card,.qmx-step,.qmx-compare-col{border:1px solid var(--paper-3);background:rgba(255,255,255,.24);border-radius:10px;padding:14px}.qmx-card span,.qmx-step span{display:block;font-size:10px;font-weight:900;color:#177E78;margin-bottom:7px}.qmx-card p,.qmx-step p,.qmx-compare-col p{margin:0;color:var(--ink-soft);font-size:13px;line-height:1.45;font-weight:700}.qmx-process{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:22px}.qmx-compare{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.qmx-compare-col b{display:block;margin-bottom:10px;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.qmx-compare-col p+p{margin-top:8px}.qmx-compare-accent{background:rgba(79,201,191,.08);border-color:rgba(23,126,120,.28)}
.qmx-quiz-shell{max-width:900px;padding:36px 40px;border:1px solid var(--paper-3);border-radius:12px;background:rgba(255,255,255,.38)}.qmx-quiz-shell h2{font-size:clamp(28px,3.2vw,42px)}.qmx-options{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}.quiz-option{min-height:60px;text-align:left;padding:14px 16px;border:1px solid var(--paper-3);border-radius:9px;background:var(--paper);color:var(--ink);font-weight:750;cursor:pointer}.quiz-option:hover:not(:disabled){background:var(--highlight)}.quiz-option.correct{background:#DFE9E1;border-color:#72917B;color:#274A31}.quiz-option.incorrect{background:#EFE0DC;border-color:#B9786B;color:#713A31}.feedback{display:none;margin-top:14px;border:1px solid var(--paper-3);border-radius:8px;padding:14px 15px;background:var(--paper-2);color:var(--ink-soft);font-size:13px;line-height:1.55;font-weight:650}.feedback strong{display:block;margin-bottom:5px;color:var(--ink)}
.qmx-final-shell{text-align:center;max-width:680px;padding:40px;border:1px solid var(--paper-3);border-radius:12px;background:rgba(255,255,255,.38)}.qmx-final-shell>p{max-width:560px;margin:auto}.qmx-score{width:150px;height:150px;border-radius:50%;margin:24px auto;display:grid;place-items:center;background:var(--ink);border:12px solid var(--paper-3)}.qmx-score span{color:#fff;font-size:34px;font-weight:900}
footer{height:64px;padding:0 26px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--paper-3);background:rgba(231,231,228,.96);z-index:10}.part{font-size:10.5px;font-weight:800;color:var(--ink-soft)}.nav-btn{min-height:42px;border-radius:8px;padding:9px 16px;font-weight:800;border:1px solid var(--paper-3);cursor:pointer}.nav-btn.primary{background:var(--ink);color:#fff;border-color:var(--ink)}.nav-btn.secondary{background:transparent;color:var(--ink)}.nav-btn:disabled{opacity:.35;cursor:not-allowed}
@media(max-width:980px){.qmx-cover-shell,.qmx-learning-shell.has-image{grid-template-columns:1fr}.qmx-cover-shell{padding:26px}.qmx-native-media{max-width:760px}.qmx-learning-shell.has-image .qmx-native-media{order:-1}.slide{padding:20px}.qmx-copy h2{font-size:clamp(30px,6vw,46px)}}@media(max-width:620px){header{height:56px;padding:0 14px}footer{height:62px;padding:0 14px}.slide{padding:14px 12px}.qmx-cover-shell,.qmx-quiz-shell,.qmx-final-shell{padding:20px 18px}.qmx-cards,.qmx-process,.qmx-compare,.qmx-options{grid-template-columns:1fr}.qmx-native-media{border-radius:14px}.qmx-copy>p{font-size:15px}.nav-btn{font-size:12px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;
}

function playerScript(analysis) {
    const quiz = JSON.stringify(Array.isArray(analysis?.quiz) ? analysis.quiz : []).replace(/</g, '\\u003c');
    return `(function(){
var quiz=${quiz},currentSlide=0,answers=[],completed=false,sessionStart=Date.now(),commitTimer=null;
function el(id){return document.getElementById(id)}
function slides(){return Array.prototype.slice.call(document.querySelectorAll('.slide'))}
function setValue(k,v){try{if(typeof doLMSSetValue==='function')return doLMSSetValue(k,String(v==null?'':v))}catch(e){}return 'false'}
function commit(){try{if(typeof doLMSCommit==='function')doLMSCommit()}catch(e){}}
function sessionTime(ms){var t=Math.max(0,Math.floor(ms/1000)),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60;function p(n){return(n<10?'0':'')+n}return (h<10?'000':h<100?'00':h<1000?'0':'')+h+':'+p(m)+':'+p(s)+'.00'}
function saveProgress(){setValue('cmi.core.session_time',sessionTime(Date.now()-sessionStart));setValue('cmi.core.lesson_location',String(currentSlide));commit()}
function score(){var hits=0;quiz.forEach(function(q,i){if(answers[i]===Number(q.correctAnswer))hits++});return quiz.length?Math.round(hits/quiz.length*100):100}
function update(){var all=slides();all.forEach(function(n,i){n.classList.toggle('active',i===currentSlide)});el('prev-btn').disabled=currentSlide===0;var next=el('next-btn');next.style.display=currentSlide===all.length-1?'none':'inline-flex';next.textContent=currentSlide===all.length-2?'Finish':'Next';el('slide-number').textContent='Part '+(currentSlide+1)+' of '+all.length;var pct=Math.round(currentSlide/Math.max(1,all.length-1)*100);el('progress-fill').style.width=pct+'%';el('progress-text').textContent=pct+'%';if(currentSlide===all.length-1){var r=el('final-res');if(r)r.textContent=score()+'%'}saveProgress()}
function move(delta){var next=currentSlide+delta,all=slides();if(next>=0&&next<all.length){currentSlide=next;update()}}
function answer(btn){var qi=Number(btn.getAttribute('data-qi')),oi=Number(btn.getAttribute('data-oi'));if(!Number.isInteger(qi)||answers[qi]!==undefined)return;answers[qi]=oi;var q=quiz[qi]||{},correct=Number(q.correctAnswer),host=btn.parentNode,buttons=host.querySelectorAll('.quiz-option');buttons.forEach(function(b,i){b.disabled=true;if(i===correct)b.classList.add('correct');else if(i===oi)b.classList.add('incorrect')});var fb=el('fb-'+qi),ok=oi===correct;fb.style.display='block';fb.textContent='';var status=document.createElement('strong');status.textContent=ok?'Correct':'Not quite';fb.appendChild(status);fb.appendChild(document.createTextNode(String(q.explanation||'Review the lesson and choose the action that best matches the course guidance.')));setValue('cmi.interactions.'+qi+'.id','quizmoto_question_'+(qi+1));setValue('cmi.interactions.'+qi+'.type','choice');setValue('cmi.interactions.'+qi+'.student_response',String(oi));setValue('cmi.interactions.'+qi+'.correct_responses.0.pattern',String(correct));setValue('cmi.interactions.'+qi+'.result',ok?'correct':'wrong');setValue('quizmoto.quiz.'+qi+'.explanation',q.explanation||'');commit()}
function finish(){if(completed)return;var finalScore=score();setValue('cmi.core.score.raw',String(finalScore));setValue('cmi.core.score.min','0');setValue('cmi.core.score.max','100');setValue('cmi.core.lesson_status',finalScore>=70?'passed':'completed');setValue('cmi.core.exit','normal');setValue('cmi.core.session_time',sessionTime(Date.now()-sessionStart));commit();try{if(typeof doLMSFinish==='function')doLMSFinish()}catch(e){}completed=true;try{if(window.opener)window.opener.postMessage({type:'quizmoto_scorm_exit'},'*')}catch(e){}try{window.close()}catch(e){}}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest?e.target.closest('.quiz-option[data-qi][data-oi]'):null;if(b)answer(b)},false);el('prev-btn').addEventListener('click',function(){move(-1)});el('next-btn').addEventListener('click',function(){move(1)});el('finish-btn').addEventListener('click',finish);
window.addEventListener('load',function(){sessionStart=Date.now();try{if(typeof doLMSInitialize==='function'){doLMSInitialize();setValue('cmi.core.score.min','0');setValue('cmi.core.score.max','100');setValue('cmi.core.lesson_status','incomplete')}}catch(e){}update();commitTimer=setInterval(function(){if(!completed)saveProgress()},15000)});
window.addEventListener('beforeunload',function(){if(completed)return;try{setValue('cmi.core.exit','suspend');saveProgress()}catch(e){}});
})();`;
}

function buildIndexHtml(analysis, theme, logoHtml) {
    const title = html(analysis?.title || 'Learning course');
    const slides = [
        renderCover(analysis),
        ...(Array.isArray(analysis?.slides) ? analysis.slides.map(renderLearningSlide) : []),
        ...(Array.isArray(analysis?.quiz) ? analysis.quiz.map(renderQuiz) : []),
        renderFinal()
    ].join('\n');
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="generator" content="Quizmoto Native Raster Course Builder"><title>${title}</title><script src="scorm_api_wrapper.js"></script><style>${playerCss(theme)}</style></head><body><div id="app"><header>${logoHtml || '<div class="brand-mark">Q</div>'}<h1>${title}</h1><div class="progress-shell"><div id="progress-fill" class="progress-fill"></div></div><span id="progress-text" class="progress-text">0%</span></header><main id="content-area">${slides}</main><footer><button id="prev-btn" class="nav-btn secondary" type="button">Previous</button><div id="slide-number" class="part">Part 1</div><button id="next-btn" class="nav-btn primary" type="button">Next</button></footer></div><script>${playerScript(analysis)}</script></body></html>`;
}

function normalizeAnalysis(raw) {
    const analysis = raw && typeof raw === 'object' ? { ...raw } : {};
    analysis.visualMode = 'raster';
    analysis.slides = (Array.isArray(analysis.slides) ? analysis.slides : []).map((slide, index) => {
        const next = { ...(slide || {}) };
        const path = rasterPath(next);
        if (path) {
            next.visualAsset = path;
            next.rasterVisualAsset = path;
            next.mobileVisualAsset = path;
            next.visualSource = 'ai_raster';
            next.visualAssetType = 'image/webp';
        } else {
            delete next.visualAsset;
            delete next.rasterVisualAsset;
            delete next.mobileVisualAsset;
        }
        next.title = text(next.title) || `Section ${index + 1}`;
        next.content = text(next.content);
        next.visualTitle = text(next.visualTitle || next.title);
        return next;
    });
    const cover = coverPath(analysis);
    if (cover) {
        analysis.coverImageAsset = cover;
        analysis.coverVisualAsset = cover;
        analysis.coverMobileVisualAsset = cover;
    }
    return analysis;
}

async function buildRasterCoursePackageZip(rawAnalysis, opts = {}) {
    const analysis = normalizeAnalysis(rawAnalysis);
    const mediaFiles = Array.isArray(opts.mediaFiles) ? opts.mediaFiles : [];
    const zip = new JSZip();
    const theme = TEMPLATES[opts.templateId] || TEMPLATES[1];

    let logoFileName = '';
    let logoHtml = '';
    if (opts.logoDataUrl) {
        const match = String(opts.logoDataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
            const ext = match[1].split('/')[1].split('+')[0];
            logoFileName = `logo.${ext}`;
            zip.file(logoFileName, match[2], { base64: true });
            logoHtml = `<img src="${logoFileName}" alt="Logo" style="height:34px;width:auto;max-width:150px;object-fit:contain">`;
        }
    }

    for (const file of mediaFiles) {
        if (file && file.path && file.body) zip.file(String(file.path), file.body);
    }

    zip.file('index.html', buildIndexHtml(analysis, theme, logoHtml));
    zip.file('scorm_api_wrapper.js', SCORM_WRAPPER);
    zip.file('content.json', JSON.stringify({ ...analysis, generatedBy: 'quizmoto', generator: 'Quizmoto Native Raster Course Builder', version: 7, experienceVersion: 7, visualEngine: 'native-raster' }, null, 2));

    const files = ['index.html', 'scorm_api_wrapper.js', 'content.json', ...(logoFileName ? [logoFileName] : []), ...mediaFiles.map((file) => String(file?.path || '')).filter(Boolean)];
    const fileEntries = [...new Set(files)].map((path) => `      <file href="${escapeXML(path)}"/>`).join('\n');
    const escapedTitle = escapeXML(analysis.title || 'Course');
    zip.file('imsmanifest.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<manifest identifier="com.quizmoto.raster.${Date.now()}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">\n  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>\n  <organizations default="ORG-1"><organization identifier="ORG-1"><title>${escapedTitle}</title><item identifier="ITEM-1" identifierref="RES-1"><title>${escapedTitle}</title></item></organization></organizations>\n  <resources><resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">\n${fileEntries}\n  </resource></resources>\n</manifest>`);

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
    buildRasterCoursePackageZip,
    buildIndexHtml,
    normalizeAnalysis,
    rasterPath,
    coverPath,
    isRasterPath,
    renderLearningSlide,
    renderCover
};
