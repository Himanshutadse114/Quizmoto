function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeJson(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderFlipbookReader(book) {
    const pageCount = Math.max(0, Number(book.pageCount || 0));
    const shareToken = String(book.shareToken || '');
    const title = escapeHtml(book.title || 'Flipbook');
    const description = escapeHtml(book.description || '');
    const pages = Array.from(
        { length: pageCount },
        (_, index) => `/api/scorm/flipbooks/public/${shareToken}/pages/${index}`
    );
    const payload = {
        title: String(book.title || 'Flipbook'),
        description: String(book.description || ''),
        pageCount,
        token: shareToken,
        pages
    };
    const pageMarkup = pages.map((src, index) => {
        const cover = index === 0;
        return `<div class="book-page${cover ? ' book-cover' : ''}"${cover ? ' data-density="hard"' : ''}><img src="${escapeHtml(src)}" alt="Page ${index + 1}" draggable="false"></div>`;
    }).join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#f7f4ee">
<title>${title} | LMSGEN Flipbook</title>
<meta name="description" content="${description}">
<style>
:root{--canvas:#f6f2eb;--surface:#fff;--line:#e1d9ce;--ink:#20262b;--muted:#7d756d;--accent:#c98742;--accent-dark:#a96827;--teal:#0f7f79;--shadow:rgba(63,48,31,.16)}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Inter,Arial,sans-serif;background:var(--canvas);color:var(--ink)}body{overflow:hidden}.shell{height:100dvh;display:grid;grid-template-rows:64px minmax(0,1fr) 82px;background:linear-gradient(180deg,#fff 0,#faf8f4 15%,#f3efe8 100%)}
.topbar{display:flex;align-items:center;gap:14px;padding:0 22px;background:rgba(255,255,255,.96);border-bottom:1px solid #e7e0d6;box-shadow:0 2px 12px rgba(58,45,30,.04);z-index:20}.brand{font-weight:850;letter-spacing:.16em;font-size:11px;color:var(--teal)}.meta{min-width:0;flex:1}.meta h1{margin:0;font-size:14px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta p{margin:4px 0 0;font-size:10px;color:#8e877f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tools{display:flex;gap:8px}.icon-btn,.nav-btn{appearance:none;border:1px solid #ddd5c9;background:#fff;color:#534b43;border-radius:11px;height:40px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:750;cursor:pointer;box-shadow:0 3px 10px rgba(68,54,35,.04);transition:.18s ease}.icon-btn:hover,.nav-btn:hover{border-color:#d4ad7d;background:#fffaf3;color:#955b1f}.icon-btn:disabled,.nav-btn:disabled{opacity:.32;cursor:not-allowed}.icon-btn.primary{background:#fff8ef;border-color:#dfc19d;color:#995b1d}
.reader-stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:16px 58px}.book-zone{width:min(calc(100vw - 150px),880px);max-width:880px;display:flex;align-items:center;justify-content:center;transition:transform .28s ease}.book-zone.front-cover{transform:translateX(-25%)}.book-zone.back-cover{transform:translateX(25%)}.flip-book{margin:0 auto;box-shadow:0 22px 42px rgba(56,44,30,.18);background:#fff;display:none}.book-page{background:#fff;overflow:hidden;border:1px solid #e3ddd4}.book-page img{display:block;width:100%;height:100%;object-fit:contain;background:#fff}.book-page.--left{border-right:0;box-shadow:inset -10px 0 26px -16px rgba(0,0,0,.35)}.book-page.--right{border-left:0;box-shadow:inset 10px 0 26px -16px rgba(0,0,0,.35)}.book-cover{border:1px solid #d7cec2;box-shadow:inset 0 0 24px rgba(70,50,30,.08)}.turn-hint{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);padding:5px 10px;border-radius:999px;border:1px solid #e3dbd0;background:rgba(255,255,255,.9);color:#91877d;font-size:9px;white-space:nowrap;pointer-events:none;transition:opacity .3s ease}.edge-arrow{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:1px solid #ded6ca;background:rgba(255,255,255,.95);color:#9a6124;display:grid;place-items:center;font-size:25px;cursor:pointer;z-index:12;box-shadow:0 8px 22px rgba(68,54,35,.09)}.edge-arrow.left{left:18px}.edge-arrow.right{right:18px}.edge-arrow:disabled{opacity:.2;cursor:not-allowed}
.control-row{display:flex;align-items:center;justify-content:center;padding:10px 16px 14px}.control-dock{width:min(820px,calc(100vw - 30px));display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #ded6ca;border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 10px 30px rgba(65,51,34,.12)}.nav-btn{height:42px;min-width:116px}.nav-btn.next{background:var(--accent);border-color:var(--accent);color:#fff}.nav-btn.next:hover{background:var(--accent-dark);color:#fff}.jump-wrap{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.jump-label{font-size:9px;color:#958b80;white-space:nowrap}.page-slider{appearance:none;width:100%;height:5px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--progress,0%),#e8e1d8 var(--progress,0%) 100%);outline:none;cursor:pointer}.page-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--accent);box-shadow:0 2px 6px rgba(80,56,28,.2)}.page-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--accent)}.page-status{min-width:74px;text-align:center;color:#a46627;font-size:11px;font-weight:800;white-space:nowrap}.page-jump{width:58px;height:36px;border:1px solid #ddd4c8;border-radius:9px;background:#fff;color:#51483f;text-align:center;font-size:11px;font-weight:700;outline:none}.page-jump:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(201,135,66,.12)}.empty{padding:35px;text-align:center;color:#82786e}
@media(max-width:760px){.shell{grid-template-rows:58px minmax(0,1fr) 76px}.topbar{padding:0 12px;gap:9px}.brand{display:none}.meta h1{font-size:13px}.meta p{display:none}.icon-btn{height:36px;min-width:36px;padding:0 10px}.icon-btn .label{display:none}.reader-stage{padding:8px 8px}.book-zone{width:min(92vw,520px);transform:none!important}.edge-arrow{display:none}.turn-hint{bottom:2px;font-size:8px}.control-row{padding:8px}.control-dock{width:100%;gap:7px;padding:8px}.nav-btn{min-width:68px;height:38px;padding:0 9px}.nav-btn .word{display:none}.jump-wrap{gap:7px}.jump-label,.page-jump{display:none}.page-status{min-width:54px;font-size:10px}}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand">LMSGEN</div>
    <div class="meta"><h1>${title}</h1><p>${description || 'Interactive flipbook'}</p></div>
    <div class="tools">
      <button class="icon-btn primary" id="shareBtn" title="Share"><span>↗</span><span class="label">Share</span></button>
      <button class="icon-btn" id="fullBtn" title="Fullscreen">⛶</button>
    </div>
  </header>
  <main class="reader-stage">
    <button class="edge-arrow left" id="leftEdge" aria-label="Previous page">‹</button>
    <div class="book-zone" id="bookZone">
      <div class="flip-book" id="book">${pageMarkup}</div>
      <div class="turn-hint" id="turnHint">Drag the cover corner to open</div>
    </div>
    <button class="edge-arrow right" id="rightEdge" aria-label="Next page">›</button>
  </main>
  <footer class="control-row">
    <div class="control-dock">
      <button class="nav-btn" id="prevBtn">← <span class="word">Previous</span></button>
      <div class="jump-wrap">
        <span class="jump-label">Page</span>
        <input id="pageSlider" class="page-slider" type="range" min="1" max="${Math.max(1, pageCount)}" value="1" step="1" aria-label="Jump to page">
        <div class="page-status" id="pageStatus">Cover</div>
        <input id="pageJump" class="page-jump" type="number" min="1" max="${Math.max(1, pageCount)}" value="1" aria-label="Go to page number">
      </div>
      <button class="nav-btn next" id="nextBtn"><span class="word">Open</span> →</button>
    </div>
  </footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script>
const DATA=${safeJson(payload)};
const bookEl=document.getElementById('book');
const bookZone=document.getElementById('bookZone');
const prevBtn=document.getElementById('prevBtn');
const nextBtn=document.getElementById('nextBtn');
const leftEdge=document.getElementById('leftEdge');
const rightEdge=document.getElementById('rightEdge');
const pageSlider=document.getElementById('pageSlider');
const pageJump=document.getElementById('pageJump');
const pageStatus=document.getElementById('pageStatus');
const turnHint=document.getElementById('turnHint');
let pageFlip=null;
let currentIndex=0;
let orientation='landscape';
let audioCtx=null;
let initialising=true;
let hintTimer=null;

function lastSpreadStart(){
  if(!DATA.pageCount)return 0;
  if(orientation==='portrait')return DATA.pageCount-1;
  if(DATA.pageCount===1)return 0;
  return DATA.pageCount%2===0?DATA.pageCount-1:Math.max(0,DATA.pageCount-2);
}

function currentSpreadLabel(index){
  if(!DATA.pageCount)return '0 / 0';
  if(index===0)return 'Cover';
  if(orientation==='portrait')return (index+1)+' / '+DATA.pageCount;
  const lastStart=lastSpreadStart();
  if(index===lastStart&&DATA.pageCount%2===0)return 'Back cover';
  const end=Math.min(DATA.pageCount,index+2);
  return (index+1)+(end>index+1?'–'+end:'')+' / '+DATA.pageCount;
}

function syncCoverPosition(){
  bookZone.classList.remove('front-cover','back-cover');
  if(orientation!=='landscape')return;
  if(currentIndex===0)bookZone.classList.add('front-cover');
  else if(currentIndex===lastSpreadStart()&&DATA.pageCount%2===0)bookZone.classList.add('back-cover');
}

function updateControls(index){
  currentIndex=Math.max(0,Math.min(Math.max(0,DATA.pageCount-1),Number(index)||0));
  if(!DATA.pageCount){
    prevBtn.disabled=true;nextBtn.disabled=true;leftEdge.disabled=true;rightEdge.disabled=true;
    pageSlider.disabled=true;pageJump.disabled=true;pageStatus.textContent='0 / 0';return;
  }
  const first=currentIndex===0;
  const last=currentIndex>=lastSpreadStart();
  prevBtn.disabled=first;leftEdge.disabled=first;nextBtn.disabled=last;rightEdge.disabled=last;
  nextBtn.innerHTML=first?'<span class="word">Open</span> →':'<span class="word">Next</span> →';
  prevBtn.innerHTML='← <span class="word">Previous</span>';
  pageSlider.value=String(currentIndex+1);
  pageJump.value=String(currentIndex+1);
  pageStatus.textContent=currentSpreadLabel(currentIndex);
  pageSlider.style.setProperty('--progress',DATA.pageCount>1?((currentIndex/(DATA.pageCount-1))*100)+'%':'100%');
  if(turnHint)turnHint.textContent=first?'Drag the hard cover corner to open':'Drag a page corner or swipe to turn';
  syncCoverPosition();
}

function ensureAudio(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    if(!audioCtx)audioCtx=new Ctx();
    if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
    return audioCtx;
  }catch(_){return null}
}

function playPageTurnSound(){
  const ctx=ensureAudio();
  if(!ctx||ctx.state!=='running')return;
  try{
    const duration=.22;
    const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<length;i+=1){const t=i/length;data[i]=(Math.random()*2-1)*Math.sin(Math.PI*t)*Math.pow(1-t,.75)}
    const src=ctx.createBufferSource();
    const hp=ctx.createBiquadFilter();
    const lp=ctx.createBiquadFilter();
    const gain=ctx.createGain();
    hp.type='highpass';hp.frequency.value=700;lp.type='lowpass';lp.frequency.value=5000;
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.07,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
    src.buffer=buffer;src.connect(hp);hp.connect(lp);lp.connect(gain);gain.connect(ctx.destination);src.start();
  }catch(_){}
}

function hideHint(){
  if(hintTimer)clearTimeout(hintTimer);
  hintTimer=setTimeout(()=>{if(turnHint)turnHint.style.opacity='0'},1500);
}

function jumpToPage(value){
  if(!pageFlip||!DATA.pageCount)return;
  const human=Math.max(1,Math.min(DATA.pageCount,Math.round(Number(value)||1)));
  const target=human-1;
  try{
    pageFlip.turnToPage(target);
    setTimeout(()=>{try{updateControls(pageFlip.getCurrentPageIndex())}catch(_){}},0);
    playPageTurnSound();
  }catch(_){}
}

function init(){
  if(!DATA.pageCount){bookEl.innerHTML='<div class="empty">This flipbook has no pages.</div>';updateControls(0);return;}
  if(!window.St||!window.St.PageFlip){bookEl.style.display='block';bookEl.innerHTML='<div class="empty">The page-turn engine could not load. Please refresh.</div>';return;}
  pageFlip=new window.St.PageFlip(bookEl,{
    width:400,
    height:566,
    size:'stretch',
    minWidth:260,
    maxWidth:440,
    minHeight:368,
    maxHeight:623,
    drawShadow:true,
    flippingTime:900,
    usePortrait:true,
    startPage:0,
    autoSize:true,
    maxShadowOpacity:.5,
    showCover:true,
    mobileScrollSupport:false,
    swipeDistance:25,
    clickEventForward:true,
    useMouseEvents:true,
    showPageCorners:true,
    disableFlipByClick:false
  });
  pageFlip.on('init',e=>{
    orientation=e.data?.mode||pageFlip.getOrientation();
    currentIndex=Number(e.data?.page)||0;
    initialising=false;
    updateControls(currentIndex);
  });
  pageFlip.on('flip',e=>{
    currentIndex=Number(e.data)||0;
    updateControls(currentIndex);
    if(!initialising)playPageTurnSound();
    hideHint();
  });
  pageFlip.on('changeOrientation',e=>{
    orientation=String(e.data||pageFlip.getOrientation());
    setTimeout(()=>{try{updateControls(pageFlip.getCurrentPageIndex())}catch(_){}},0);
  });
  pageFlip.loadFromHTML(document.querySelectorAll('#book .book-page'));

  prevBtn.onclick=()=>{ensureAudio();try{pageFlip.flipPrev('top')}catch(_){}};
  nextBtn.onclick=()=>{ensureAudio();try{pageFlip.flipNext('top')}catch(_){}};
  leftEdge.onclick=prevBtn.onclick;
  rightEdge.onclick=nextBtn.onclick;
  pageSlider.addEventListener('input',()=>{
    const human=Number(pageSlider.value)||1;
    pageJump.value=String(human);
    pageStatus.textContent=human+' / '+DATA.pageCount;
    pageSlider.style.setProperty('--progress',DATA.pageCount>1?(((human-1)/(DATA.pageCount-1))*100)+'%':'100%');
  });
  pageSlider.addEventListener('change',()=>jumpToPage(pageSlider.value));
  pageJump.addEventListener('change',()=>jumpToPage(pageJump.value));
  pageJump.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jumpToPage(pageJump.value);pageJump.blur()}});
  document.addEventListener('keydown',e=>{
    if(document.activeElement===pageJump||document.activeElement===pageSlider)return;
    ensureAudio();
    if(e.key==='ArrowRight'||e.key==='PageDown')nextBtn.onclick();
    if(e.key==='ArrowLeft'||e.key==='PageUp')prevBtn.onclick();
    if(e.key==='Home')jumpToPage(1);
    if(e.key==='End')jumpToPage(DATA.pageCount);
  });
  document.addEventListener('pointerdown',ensureAudio,{once:true});
}

window.addEventListener('load',init,{once:true});
document.getElementById('fullBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
document.getElementById('shareBtn').onclick=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:DATA.title,url});else{await navigator.clipboard.writeText(url);const b=document.getElementById('shareBtn');const old=b.innerHTML;b.textContent='Copied';setTimeout(()=>b.innerHTML=old,1200)}}catch(_){}};
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };
