/**
 * Builds a SCORM 1.2 ZIP from PolicyAnalysis JSON (Quizmoto AI Author).
 * Layout: tight padding, SVG icons (no emoji), word-wrap, content top-aligned.
 * content.json includes generatedBy: quizmoto for edit gating.
 */
const JSZip = require('jszip');

function escapeXML(str) {
    const map = {
        '<': ['&', 'lt;'].join(''),
        '>': ['&', 'gt;'].join(''),
        '&': ['&', 'amp;'].join(''),
        '"': ['&', 'quot;'].join(''),
        "'": ['&', 'apos;'].join('')
    };
    return String(str || '').replace(/[<>&"']/g, (m) => map[m] || m);
}

const TEMPLATES = {
    1: { primary: '#f97316', primaryDark: '#ea580c', accent: '#fdba74', bg: '#0f172a', surface: '#ffffff', text: '#1e293b', headerText: '#ffffff', secondaryBg: '#f8fafc', font: "'Inter', sans-serif" },
    3: { primary: '#b45309', primaryDark: '#92400e', accent: '#fde68a', bg: '#451a03', surface: '#fffbeb', text: '#451a03', headerText: '#ffffff', secondaryBg: '#fef3c7', font: "'Playfair Display', serif" },
    4: { primary: '#059669', primaryDark: '#047857', accent: '#6ee7b7', bg: '#064e3b', surface: '#f0fdf4', text: '#064e3b', headerText: '#ffffff', secondaryBg: '#d1fae5', font: "'Outfit', sans-serif" },
    5: { primary: '#db2777', primaryDark: '#be185d', accent: '#fca5a5', bg: '#4c0519', surface: '#fff1f2', text: '#4c0519', headerText: '#ffffff', secondaryBg: '#ffe4e6', font: "'Inter', sans-serif" }
};

function buildPlayerHtml(analysis, theme, logoHtml, escapedTitle) {
    const dataJson = JSON.stringify(analysis).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="Quizmoto AI Author">
<meta name="quizmoto-editable" content="1">
<title>${escapedTitle}</title>
<script src="scorm_api_wrapper.js"></script>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@700;900&family=Outfit:wght@400;600;800&display=swap');
:root{--primary:${theme.primary};--primary-dark:${theme.primaryDark};--accent:${theme.accent};--bg:${theme.bg};--surface:${theme.surface};--text:${theme.text};--secondary-bg:${theme.secondaryBg}}
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;font-family:${theme.font};background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased}
#app{width:100%;height:100%;display:flex;flex-direction:column;background:var(--surface)}
header{min-height:52px;padding:.65rem 1.1rem;background:var(--primary);color:${theme.headerText};display:flex;align-items:center;gap:.65rem;flex-shrink:0}
header h1{font-size:clamp(.78rem,2vw,.95rem);font-weight:900;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0;line-height:1.25}
main{flex:1;min-height:0;position:relative;overflow:hidden;background:var(--surface)}
footer{min-height:52px;padding:.55rem 1.1rem;background:var(--secondary-bg);border-top:1px solid rgba(0,0,0,.06);display:flex;align-items:center;justify-content:space-between;gap:.65rem;flex-shrink:0}
.slide{position:absolute;inset:0;display:none;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}
.slide.active{display:block}
.slide-inner{max-width:920px;width:100%;margin:0 auto;padding:clamp(.85rem,2vw,1.35rem);display:flex;flex-direction:column;justify-content:flex-start;gap:.85rem}
.slide-inner.center{min-height:100%;justify-content:center;align-items:center;text-align:center}
.icon-wrap{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:var(--secondary-bg);color:var(--primary);margin:0 auto .5rem}
.content-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.65fr);gap:clamp(.85rem,2vw,1.25rem);align-items:start;width:100%}
@media(max-width:800px){.content-grid{grid-template-columns:1fr}}
.card{background:var(--secondary-bg);border-radius:.9rem;padding:clamp(.8rem,1.8vw,1.1rem);border-left:5px solid var(--primary)}
.card p{margin:0;font-size:clamp(.9rem,1.5vw,1.02rem);line-height:1.55;font-weight:500;color:var(--text);word-wrap:break-word;overflow-wrap:anywhere}
.kps{display:flex;flex-direction:column;gap:.5rem}
.kp{display:flex;gap:.5rem;align-items:flex-start;padding:.65rem .75rem;background:#fff;border-radius:.7rem;border:1px solid rgba(0,0,0,.06)}
.kp-dot{flex-shrink:0;width:8px;height:8px;border-radius:50%;background:var(--primary);margin-top:.4rem}
.kp p{margin:0;font-weight:600;font-size:.85rem;line-height:1.4;color:var(--text);word-wrap:break-word;overflow-wrap:anywhere}
.section-label{font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.16em;color:var(--primary);margin:0}
.slide-title{font-size:clamp(1.15rem,2.5vw,1.55rem);font-weight:900;line-height:1.2;margin:0;word-wrap:break-word;overflow-wrap:anywhere}
.quiz-wrap{max-width:700px;margin:0 auto;width:100%;display:flex;flex-direction:column;gap:.9rem}
.quiz-opts{display:grid;grid-template-columns:1fr 1fr;gap:.65rem}
@media(max-width:600px){.quiz-opts{grid-template-columns:1fr}}
.quiz-option{background:#fff;border:2px solid #e8eef5;border-radius:.8rem;padding:.75rem .9rem;text-align:left;cursor:pointer;width:100%;font-weight:600;font-size:.88rem;line-height:1.35;display:flex;justify-content:space-between;align-items:center;gap:.45rem;color:var(--text);word-wrap:break-word}
.quiz-option.correct{background:#f0fdf4;border-color:#22c55e}
.quiz-option.incorrect{background:#fef2f2;border-color:#ef4444}
#progress-bar{height:6px;background:rgba(255,255,255,.25);border-radius:4px;flex:1;min-width:36px;max-width:120px;overflow:hidden}
#progress-fill{height:100%;background:var(--accent);width:0%;transition:width .3s}
.btn{padding:.6rem 1.05rem;border-radius:11px;font-weight:800;font-size:.68rem;text-transform:uppercase;letter-spacing:.07em;border:none;cursor:pointer;white-space:nowrap}
.btn-primary{background:var(--primary);color:#fff}
.btn-secondary{background:#fff;border:1px solid #e2e8f0;color:#64748b}
.btn:disabled{opacity:.35;cursor:not-allowed}
.score-box{background:var(--primary);color:#fff;padding:1.25rem 1.5rem;border-radius:1.1rem;margin:.75rem 0}
.summary-box{background:var(--secondary-bg);padding:1rem 1.15rem;border-radius:1rem;border:2px solid var(--accent);text-align:left;max-width:560px;width:100%}
.summary-box p{margin:0;font-size:clamp(.9rem,1.6vw,1.05rem);font-weight:600;font-style:italic;color:var(--primary-dark);line-height:1.5;word-wrap:break-word}
</style>
</head>
<body>
<div id="app">
  <header>${logoHtml}<h1 title="${escapedTitle}">${escapedTitle}</h1>
    <div id="progress-bar"><div id="progress-fill"></div></div>
    <span id="progress-text" style="font-size:.7rem;font-weight:900;margin-left:.25rem;flex-shrink:0">0%</span>
  </header>
  <main id="content-area"></main>
  <footer>
    <button id="prev-btn" class="btn btn-secondary" type="button">Previous</button>
    <div id="slide-number" style="font-size:.65rem;font-weight:900;color:#94a3b8;letter-spacing:.08em;text-transform:uppercase;text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis">...</div>
    <button id="next-btn" class="btn btn-primary" type="button">Next</button>
  </footer>
</div>
<script>
(function(){
  var data = ${dataJson};
  var currentSlide = 0;
  var score = 0;
  var quizResults = [];
  var completed = false;
  var sessionStartMs = Date.now();
  var commitTimer = null;
  function el(id){ return document.getElementById(id); }
  function formatSessionTime(ms) {
    var totalSec = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var frac = Math.floor((ms % 1000) / 10);
    function pad2(n){ return (n < 10 ? '0' : '') + n; }
    function pad4(n){ return (n < 10 ? '000' : n < 100 ? '00' : n < 1000 ? '0' : '') + n; }
    return pad4(h) + ':' + pad2(m) + ':' + pad2(s) + '.' + pad2(frac);
  }
  function elapsedMs() { return Date.now() - sessionStartMs; }
  function writeSessionTime() {
    if (typeof doLMSSetValue !== 'function') return;
    try { doLMSSetValue('cmi.core.session_time', formatSessionTime(elapsedMs())); } catch (e) {}
  }
  function commitProgress(extra) {
    if (typeof doLMSSetValue !== 'function') return;
    try {
      writeSessionTime();
      if (extra && typeof extra === 'object') {
        for (var k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k)) doLMSSetValue(k, String(extra[k]));
        }
      }
      doLMSCommit();
    } catch (e) {}
  }
  function esc(s){ var M={'<':'&'+'lt;','>':'&'+'gt;','&':'&'+'amp;','"':'&'+'quot;',"'":'&'+'apos;'}; return String(s||'').replace(/[<>&"']/g,function(c){return M[c]||c;}); }
  function render(){
    var area = el('content-area');
    area.innerHTML = '';
    var intro = document.createElement('div');
    intro.className = 'slide active';
    intro.innerHTML = '<div class="slide-inner center"><div class="icon-wrap"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2 class="slide-title" style="margin-bottom:.5rem">Welcome</h2><div class="summary-box"><p>' + esc(data.summary) + '</p></div><p style="margin-top:.85rem;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.12em;font-size:.68rem">Click Next to start</p></div>';
    area.appendChild(intro);
    (data.slides || []).forEach(function(s, i){
      var node = document.createElement('div');
      node.className = 'slide';
      var kps = (s.keyPoints || []).map(function(p){
        return '<div class="kp"><span class="kp-dot"></span><p>' + esc(p) + '</p></div>';
      }).join('');
      node.innerHTML = '<div class="slide-inner"><div class="content-grid"><div><p class="section-label">Section ' + (i+1) + '</p><h2 class="slide-title">' + esc(s.title) + '</h2><div class="card"><p>' + esc(s.content) + '</p></div></div><div><p class="section-label">Key insights</p><div class="kps" style="margin-top:.45rem">' + kps + '</div></div></div></div>';
      area.appendChild(node);
    });
    (data.quiz || []).forEach(function(q, i){
      var node = document.createElement('div');
      node.className = 'slide';
      var opts = (q.options || []).map(function(o, oi){
        return '<button type="button" class="quiz-option" data-qi="' + i + '" data-oi="' + oi + '"><span>' + esc(o) + '</span><span style="width:18px;height:18px;border:2px solid #cbd5e1;border-radius:50%;flex-shrink:0"></span></button>';
      }).join('');
      node.innerHTML = '<div class="slide-inner center"><div class="quiz-wrap"><div style="text-align:center"><p class="section-label">Knowledge check</p><h2 class="slide-title" style="margin-top:.3rem">' + esc(q.question) + '</h2></div><div id="opts-' + i + '" class="quiz-opts">' + opts + '</div><div id="fb-' + i + '" style="display:none;padding:.7rem;border-radius:.7rem;text-align:center;font-weight:800;font-size:.88rem"></div></div></div>';
      area.appendChild(node);
    });
    var final = document.createElement('div');
    final.className = 'slide';
    final.innerHTML = '<div class="slide-inner center"><div class="icon-wrap"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" opacity=".3"/><path d="M7 12.5l3.2 3.2L17 8.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h2 class="slide-title">Completed</h2><div class="score-box"><p style="font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:var(--accent);margin:0 0 .2rem">Final score</p><p id="final-res" style="font-size:clamp(2.1rem,5.5vw,3rem);font-weight:900;margin:0;line-height:1">--%</p></div><button type="button" class="btn btn-primary" id="finish-btn" style="margin:0 auto;padding:.8rem 1.6rem">Finish course</button></div>';
    area.appendChild(final);
    area.querySelectorAll('.quiz-option').forEach(function(btn){
      btn.addEventListener('click', function(){
        answer(Number(btn.getAttribute('data-qi')), Number(btn.getAttribute('data-oi')));
      });
    });
    el('finish-btn').addEventListener('click', exitSco);
    updateNav();
  }
  function moveSlide(n){
    var slides = document.querySelectorAll('.slide');
    if (currentSlide + n >= 0 && currentSlide + n < slides.length) {
      slides[currentSlide].classList.remove('active');
      currentSlide += n;
      slides[currentSlide].classList.add('active');
      updateNav();
    }
  }
  function updateNav(){
    var slides = document.querySelectorAll('.slide');
    el('prev-btn').disabled = currentSlide === 0;
    var next = el('next-btn');
    if (currentSlide === slides.length - 1) {
      next.style.display = 'none';
      calcScore();
    } else {
      next.style.display = 'inline-flex';
      next.textContent = currentSlide === slides.length - 2 ? 'Finish' : 'Next';
    }
    el('slide-number').textContent = 'Part ' + (currentSlide + 1) + ' of ' + slides.length;
    var p = Math.round((currentSlide / Math.max(1, slides.length - 1)) * 100);
    el('progress-fill').style.width = p + '%';
    el('progress-text').textContent = p + '%';
    commitProgress({ 'cmi.core.lesson_location': String(currentSlide) });
  }
  function answer(qi, oi){
    if (quizResults[qi] !== undefined) return;
    quizResults[qi] = oi;
    var correct = data.quiz[qi].correctAnswer;
    var container = el('opts-' + qi);
    var btns = container.querySelectorAll('button');
    btns.forEach(function(b, i){
      b.disabled = true;
      if (i === correct) b.classList.add('correct');
      else if (i === oi) b.classList.add('incorrect');
    });
    var fb = el('fb-' + qi);
    fb.style.display = 'block';
    if (oi === correct) {
      fb.textContent = 'Correct — well done.';
      fb.style.background = '#f0fdf4';
      fb.style.color = '#166534';
    } else {
      fb.textContent = 'Not quite. The correct answer is highlighted.';
      fb.style.background = '#fef2f2';
      fb.style.color = '#991b1b';
    }
  }
  function calcScore(){
    var hits = 0;
    (data.quiz || []).forEach(function(q, i){ if (quizResults[i] === q.correctAnswer) hits++; });
    score = data.quiz && data.quiz.length ? Math.round((hits / data.quiz.length) * 100) : 0;
    var elr = el('final-res');
    if (elr) elr.textContent = score + '%';
  }
  function exitSco(){
    if (completed) return;
    calcScore();
    if (commitTimer) { try { clearInterval(commitTimer); } catch(e) {} commitTimer = null; }
    if (typeof doLMSSetValue === 'function') {
      writeSessionTime();
      doLMSSetValue('cmi.core.score.raw', String(score));
      doLMSSetValue('cmi.core.score.min', '0');
      doLMSSetValue('cmi.core.score.max', '100');
      doLMSSetValue('cmi.core.lesson_status', score >= 70 ? 'passed' : 'completed');
      doLMSSetValue('cmi.core.exit', 'normal');
      doLMSCommit();
      doLMSFinish();
    }
    completed = true;
    try { if (window.opener) window.opener.postMessage({ type: 'quizmoto_scorm_exit' }, '*'); } catch (e) {}
    alert('Training complete. Your score: ' + score + '%. You can close this window.');
    try { window.close(); } catch (e) {}
  }
  el('prev-btn').addEventListener('click', function(){ moveSlide(-1); });
  el('next-btn').addEventListener('click', function(){ moveSlide(1); });
  window.onload = function(){
    sessionStartMs = Date.now();
    render();
    if (typeof doLMSInitialize === 'function') {
      doLMSInitialize();
      doLMSSetValue('cmi.core.score.min', '0');
      doLMSSetValue('cmi.core.score.max', '100');
      doLMSSetValue('cmi.core.lesson_status', 'incomplete');
      writeSessionTime();
      doLMSCommit();
      commitTimer = setInterval(function(){ if (!completed) commitProgress(); }, 15000);
    }
  };
  window.addEventListener('beforeunload', function(){
    if (completed) return;
    try {
      writeSessionTime();
      if (typeof doLMSSetValue === 'function') {
        doLMSSetValue('cmi.core.exit', 'suspend');
        doLMSCommit();
      }
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}

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

async function buildScormPackageZip(analysis, opts = {}) {
    const zip = new JSZip();
    const escapedTitle = escapeXML(analysis.title || 'Course');
    const theme = TEMPLATES[opts.templateId] || TEMPLATES[1];

    let logoFileName = '';
    let logoHtml = '';
    if (opts.logoDataUrl) {
        const matches = String(opts.logoDataUrl).match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (matches) {
            const mimeType = matches[1];
            const base64Data = matches[2];
            const ext = mimeType.split('/')[1].split('+')[0];
            logoFileName = `logo.${ext}`;
            zip.file(logoFileName, base64Data, { base64: true });
            logoHtml = `<img src="${logoFileName}" alt="Logo" style="height:36px;width:auto;object-fit:contain"/>`;
        }
    }

    const playerHtml = buildPlayerHtml(analysis, theme, logoHtml, escapedTitle);
    zip.file('index.html', playerHtml);
    zip.file('scorm_api_wrapper.js', SCORM_WRAPPER);

    const analysisWithMeta = {
        ...analysis,
        generatedBy: 'quizmoto',
        generator: 'Quizmoto AI Author',
        version: 1
    };
    zip.file('content.json', JSON.stringify(analysisWithMeta, null, 2));

    const logoFileEntry = logoFileName ? `\n      <file href="${logoFileName}"/>` : '';
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.quizmoto.ai.${Date.now()}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${escapedTitle}</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>${escapedTitle}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="scorm_api_wrapper.js"/>
      <file href="content.json"/>${logoFileEntry}
    </resource>
  </resources>
</manifest>`;
    zip.file('imsmanifest.xml', manifest);

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    return buf;
}

module.exports = {
    buildScormPackageZip,
    TEMPLATES,
    escapeXML
};
