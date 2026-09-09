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
    const storedPages = Array.isArray(book.pages) ? book.pages : [];
    const firstWidth = Number(storedPages[0]?.width || 0);
    const firstHeight = Number(storedPages[0]?.height || 0);
    const aspectRatio = firstWidth > 0 && firstHeight > 0
        ? Math.max(0.35, Math.min(1.8, firstWidth / firstHeight))
        : (1 / Math.sqrt(2));
    const pages = Array.from(
        { length: pageCount },
        (_, index) => `/api/scorm/flipbooks/public/${shareToken}/pages/${index}`
    );
    const payload = {
        title: String(book.title || 'Flipbook'),
        description: String(book.description || ''),
        pageCount,
        token: shareToken,
        aspectRatio,
        pages
    };

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
:root{--canvas:#f7f4ee;--surface:#fff;--line:#e4ddd3;--ink:#24282c;--muted:#827970;--accent:#ca8b49;--accent-dark:#ad6f31;--teal:#0f817b;--shadow:rgba(65,50,33,.16)}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Inter,Arial,sans-serif;background:var(--canvas);color:var(--ink)}body{overflow:hidden}.reader-shell{height:100dvh;display:grid;grid-template-rows:62px minmax(0,1fr) 84px;background:linear-gradient(180deg,#fff 0,#fbf9f5 14%,#f4f0e9 100%)}
.reader-header{display:flex;align-items:center;gap:14px;padding:0 22px;background:rgba(255,255,255,.96);border-bottom:1px solid #e9e2d8;box-shadow:0 2px 10px rgba(60,47,32,.04);z-index:20}.reader-brand{font-weight:850;letter-spacing:.16em;font-size:11px;color:var(--teal)}.reader-meta{min-width:0;flex:1}.reader-meta h1{margin:0;font-size:14px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reader-meta p{margin:4px 0 0;font-size:10px;color:#8d857d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.reader-tools{display:flex;gap:8px}
.icon-btn,.nav-btn{appearance:none;border:1px solid #ded6ca;background:#fff;color:#554c43;border-radius:11px;height:40px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:750;cursor:pointer;box-shadow:0 3px 9px rgba(68,54,35,.04);transition:background .18s ease,border-color .18s ease,color .18s ease,transform .12s ease}.icon-btn:hover,.nav-btn:hover{border-color:#d8b58b;background:#fffaf3;color:#94591f}.icon-btn:active,.nav-btn:active{transform:translateY(1px)}.icon-btn:disabled,.nav-btn:disabled{opacity:.3;cursor:not-allowed}.icon-btn.primary{background:#fff8ef;border-color:#dfc29f;color:#995b1d}
.reader-stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:14px 64px}.book-container{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:visible}.flip-book{margin:0 auto;opacity:0;transition:opacity .18s ease,clip-path .18s ease;filter:drop-shadow(0 22px 34px rgba(59,45,30,.2));clip-path:inset(0 0 0 0)}.book-container.front-cover .flip-book{clip-path:inset(0 0 0 50%)}.book-container.back-cover .flip-book{clip-path:inset(0 50% 0 0)}.flip-book.is-ready{opacity:1}.turn-hint{position:absolute;left:50%;bottom:5px;transform:translateX(-50%);padding:5px 10px;border-radius:999px;border:1px solid #e4ddd3;background:rgba(255,255,255,.91);color:#91877d;font-size:9px;white-space:nowrap;pointer-events:none;transition:opacity .3s ease}.edge-arrow{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:1px solid #ded6ca;background:rgba(255,255,255,.96);color:#996024;display:grid;place-items:center;font-size:25px;cursor:pointer;z-index:12;box-shadow:0 8px 22px rgba(68,54,35,.09)}.edge-arrow.left{left:18px}.edge-arrow.right{right:18px}.edge-arrow:hover{background:#fff8ef;border-color:#d9b98f}.edge-arrow:disabled{opacity:.2;cursor:not-allowed}.empty{padding:36px;text-align:center;color:#81776d}
.control-row{display:flex;align-items:center;justify-content:center;padding:9px 16px 14px}.control-dock{width:min(820px,calc(100vw - 30px));display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid #ded6ca;border-radius:16px;background:rgba(255,255,255,.98);box-shadow:0 10px 30px rgba(65,51,34,.12)}.nav-btn{height:42px;min-width:116px}.nav-btn.next{background:var(--accent);border-color:var(--accent);color:#fff}.nav-btn.next:hover{background:var(--accent-dark);color:#fff}.seek-wrap{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.seek-label{font-size:9px;color:#958b80;white-space:nowrap}.page-slider{appearance:none;width:100%;height:5px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--progress,0%),#e8e1d8 var(--progress,0%) 100%);outline:none;cursor:pointer}.page-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--accent);box-shadow:0 2px 6px rgba(80,56,28,.2)}.page-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--accent)}.page-status{min-width:70px;text-align:center;color:#a46627;font-size:11px;font-weight:800;white-space:nowrap}.page-jump{width:58px;height:36px;border:1px solid #ddd4c8;border-radius:9px;background:#fff;color:#51483f;text-align:center;font-size:11px;font-weight:700;outline:none}.page-jump:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(201,135,66,.12)}
@media(max-width:760px){.reader-shell{grid-template-rows:58px minmax(0,1fr) 76px}.reader-header{padding:0 12px;gap:9px}.reader-brand{display:none}.reader-meta h1{font-size:13px}.reader-meta p{display:none}.icon-btn{height:36px;min-width:36px;padding:0 10px}.icon-btn .label{display:none}.reader-stage{padding:8px}.book-container.front-cover .flip-book,.book-container.back-cover .flip-book{clip-path:inset(0 0 0 0)}.edge-arrow{display:none}.turn-hint{bottom:1px;font-size:8px}.control-row{padding:7px}.control-dock{width:100%;gap:7px;padding:8px}.nav-btn{min-width:68px;height:38px;padding:0 9px}.nav-btn .word{display:none}.seek-wrap{gap:7px}.seek-label,.page-jump{display:none}.page-status{min-width:52px;font-size:10px}}
</style>
</head>
<body>
<div class="reader-shell">
  <header class="reader-header">
    <div class="reader-brand">LMSGEN</div>
    <div class="reader-meta"><h1>${title}</h1><p>${description || 'Interactive flipbook'}</p></div>
    <div class="reader-tools">
      <button class="icon-btn primary" id="shareBtn" title="Share"><span>↗</span><span class="label">Share</span></button>
      <button class="icon-btn" id="fullBtn" title="Fullscreen">⛶</button>
    </div>
  </header>
  <main class="reader-stage">
    <button class="edge-arrow left" id="leftEdge" aria-label="Previous page">‹</button>
    <div class="book-container front-cover" id="bookContainer"><div class="flip-book" id="book"></div></div>
    <div class="turn-hint" id="turnHint">Drag the cover corner to open</div>
    <button class="edge-arrow right" id="rightEdge" aria-label="Next page">›</button>
  </main>
  <footer class="control-row">
    <div class="control-dock">
      <button class="nav-btn" id="prevBtn">← <span class="word">Previous</span></button>
      <div class="seek-wrap">
        <span class="seek-label">Page</span>
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
const bookContainer=document.getElementById('bookContainer');
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
let hintTimer=null;

function isMobile(){return window.innerWidth<768}

function pageDimensions(){
  const ratio=Math.max(.35,Math.min(1.8,Number(DATA.aspectRatio)||.70710678));
  const mobile=isMobile();
  const maxStageHeight=Math.max(300,window.innerHeight-(mobile?154:174));
  if(mobile){
    let width=Math.min(window.innerWidth-28,420);
    let height=width/ratio;
    if(height>maxStageHeight){height=maxStageHeight;width=height*ratio}
    return {width:Math.max(180,Math.round(width)),height:Math.max(255,Math.round(height)),mobile:true};
  }
  let height=Math.min(maxStageHeight,760);
  let width=height*ratio;
  const maxSpreadWidth=Math.max(520,window.innerWidth-170);
  if(width*2>maxSpreadWidth){width=maxSpreadWidth/2;height=width/ratio}
  return {width:Math.max(240,Math.round(width)),height:Math.max(340,Math.round(height)),mobile:false};
}

function collectionState(){
  try{
    const collection=pageFlip?.getPageCollection?.();
    if(!collection)return null;
    const spreadIndex=collection.getCurrentSpreadIndex();
    const spreads=collection.getSpread();
    return {spreadIndex,spreadCount:Array.isArray(spreads)?spreads.length:0};
  }catch(_){return null}
}

function syncCoverAlignment(){
  bookContainer.classList.remove('front-cover','back-cover');
  if(orientation!=='landscape'||!DATA.pageCount)return;
  if(currentIndex===0)bookContainer.classList.add('front-cover');
  else if(currentIndex===DATA.pageCount-1)bookContainer.classList.add('back-cover');
}

function updateControls(index){
  currentIndex=Math.max(0,Math.min(Math.max(0,DATA.pageCount-1),Number(index)||0));
  if(!DATA.pageCount){
    prevBtn.disabled=true;nextBtn.disabled=true;leftEdge.disabled=true;rightEdge.disabled=true;
    pageSlider.disabled=true;pageJump.disabled=true;pageStatus.textContent='0 / 0';return;
  }
  const state=collectionState();
  const canPrev=state?state.spreadIndex>0:currentIndex>0;
  const canNext=state?state.spreadIndex<state.spreadCount-1:currentIndex<DATA.pageCount-1;
  prevBtn.disabled=!canPrev;leftEdge.disabled=!canPrev;nextBtn.disabled=!canNext;rightEdge.disabled=!canNext;
  nextBtn.innerHTML=currentIndex===0?'<span class="word">Open</span> →':'<span class="word">Next</span> →';
  pageSlider.value=String(currentIndex+1);
  pageJump.value=String(currentIndex+1);
  pageStatus.textContent=currentIndex===0?'Cover':currentIndex===DATA.pageCount-1?'Back cover':(currentIndex+1)+' / '+DATA.pageCount;
  pageSlider.style.setProperty('--progress',DATA.pageCount>1?((currentIndex/(DATA.pageCount-1))*100)+'%':'100%');
  if(turnHint)turnHint.textContent=currentIndex===0?'Drag the cover corner to open':currentIndex===DATA.pageCount-1?'Turn back to reopen':'Drag a page corner or swipe to turn';
  syncCoverAlignment();
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
    hp.type='highpass';hp.frequency.value=680;lp.type='lowpass';lp.frequency.value=5100;
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
  ensureAudio();
  try{pageFlip.flip(target,'top')}catch(_){try{pageFlip.turnToPage(target);updateControls(pageFlip.getCurrentPageIndex())}catch(__){}}
}

function init(){
  if(!DATA.pageCount){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">This flipbook has no pages.</div>';updateControls(0);return}
  if(!window.St||!window.St.PageFlip){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">The page-turn engine could not load. Please refresh.</div>';return}
  const dims=pageDimensions();
  pageFlip=new window.St.PageFlip(bookEl,{
    width:dims.width,
    height:dims.height,
    size:'fixed',
    minWidth:dims.width,
    maxWidth:dims.width,
    minHeight:dims.height,
    maxHeight:dims.height,
    drawShadow:true,
    flippingTime:900,
    usePortrait:dims.mobile,
    startPage:0,
    autoSize:true,
    maxShadowOpacity:.5,
    showCover:true,
    mobileScrollSupport:true,
    swipeDistance:30,
    clickEventForward:true,
    useMouseEvents:true,
    showPageCorners:true,
    disableFlipByClick:false
  });
  pageFlip.on('init',e=>{
    currentIndex=Number(e.data?.page)||0;
    orientation=String(e.data?.mode||pageFlip.getOrientation()||'landscape');
    bookEl.classList.add('is-ready');
    updateControls(currentIndex);
  });
  pageFlip.on('flip',e=>{
    currentIndex=Number(e.data)||0;
    updateControls(currentIndex);
    playPageTurnSound();
    hideHint();
  });
  pageFlip.on('changeOrientation',e=>{
    orientation=String(e.data||pageFlip.getOrientation()||orientation);
    setTimeout(()=>{try{updateControls(pageFlip.getCurrentPageIndex())}catch(_){}},0);
  });
  pageFlip.loadFromImages(DATA.pages);

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
    if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();nextBtn.onclick()}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();prevBtn.onclick()}
    if(e.key==='Home'){e.preventDefault();jumpToPage(1)}
    if(e.key==='End'){e.preventDefault();jumpToPage(DATA.pageCount)}
  });
  document.addEventListener('pointerdown',ensureAudio,{once:true});
}

window.addEventListener('load',init,{once:true});
document.getElementById('fullBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){} };
document.getElementById('shareBtn').onclick=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:DATA.title,url});else{await navigator.clipboard.writeText(url);const b=document.getElementById('shareBtn');const old=b.innerHTML;b.textContent='Copied';setTimeout(()=>b.innerHTML=old,1200)}}catch(_){} };
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };