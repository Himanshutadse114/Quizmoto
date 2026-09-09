function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeJson(value) {
    return JSON.stringify(value).replace(/</g, '\u003c');
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
    const pageMarkup = pages.map((src, index) => {
        const isFront = index === 0;
        const isBack = pageCount > 1 && index === pageCount - 1;
        const hard = isFront || isBack;
        const classes = ['book-page'];
        if (isFront) classes.push('front-cover-page');
        if (isBack) classes.push('back-cover-page');
        return `<div class="${classes.join(' ')}"${hard ? ' data-density="hard"' : ''}><img src="${escapeHtml(src)}" alt="Page ${index + 1}" draggable="false"></div>`;
    }).join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#f4fbfa">
<title>${title} | LMSGEN Flipbook</title>
<meta name="description" content="${description}">
<style>
:root{--canvas:#f4fbfa;--surface:#ffffff;--line:#d7ece8;--ink:#17313a;--muted:#6a8588;--accent:#17b6b0;--accent-dark:#0f9a95;--accent-soft:#e8f8f7;--teal:#17b6b0}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Inter,Arial,sans-serif;background:var(--canvas);color:var(--ink)}body{overflow:hidden}.reader-shell{height:100dvh;display:grid;grid-template-rows:minmax(0,1fr) 78px;background:linear-gradient(180deg,#ffffff 0,#f7fcfb 10%,#eef8f7 100%)}
.reader-stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;padding:8px 56px 6px}.zoom-space{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.book-frame{display:flex;align-items:center;justify-content:center;overflow:visible;transform-origin:center center;transition:transform .18s ease}.flip-book{opacity:0;transition:opacity .18s ease;filter:drop-shadow(0 24px 38px rgba(23,49,58,.18))}.flip-book.is-ready{opacity:1}.book-page{background:#fff;overflow:hidden}.book-page img{display:block;width:100%;height:100%;object-fit:contain;background:#fff}.front-cover-page,.back-cover-page{box-shadow:inset 0 0 24px rgba(23,49,58,.08)}.turn-hint{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.94);color:var(--muted);font-size:9px;white-space:nowrap;pointer-events:none;transition:opacity .3s ease;z-index:10}.edge-arrow{position:fixed;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.97);color:var(--accent-dark);display:grid;place-items:center;font-size:25px;cursor:pointer;z-index:12;box-shadow:0 8px 22px rgba(23,49,58,.09)}.edge-arrow.left{left:16px}.edge-arrow.right{right:16px}.edge-arrow:hover{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-dark)}.edge-arrow:disabled{opacity:.2;cursor:not-allowed}.empty{padding:36px;text-align:center;color:var(--muted)}
.control-row{display:flex;align-items:center;justify-content:center;padding:7px 12px 11px;background:linear-gradient(180deg,rgba(244,251,250,0),var(--canvas) 28%)}.control-dock{width:min(1080px,calc(100vw - 20px));display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.985);box-shadow:0 10px 30px rgba(23,49,58,.1)}.nav-btn,.tool-btn{appearance:none;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;height:40px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-weight:750;cursor:pointer;white-space:nowrap;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .12s ease}.nav-btn:hover,.tool-btn:hover{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-dark)}.nav-btn:active,.tool-btn:active{transform:translateY(1px)}.nav-btn:disabled,.tool-btn:disabled{opacity:.3;cursor:not-allowed}.nav-btn{min-width:104px}.nav-btn.next{background:var(--accent);border-color:var(--accent);color:#fff}.nav-btn.next:hover{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}.seek-wrap{display:flex;align-items:center;gap:8px;flex:1;min-width:160px}.seek-label{font-size:9px;color:var(--muted);white-space:nowrap}.page-slider{appearance:none;width:100%;height:5px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--progress,0%),#dfeceb var(--progress,0%) 100%);outline:none;cursor:pointer}.page-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--accent);box-shadow:0 2px 6px rgba(15,154,149,.18)}.page-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--accent)}.page-status{min-width:78px;text-align:center;color:var(--accent-dark);font-size:10px;font-weight:800;white-space:nowrap}.page-jump{width:52px;height:34px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);text-align:center;font-size:10px;font-weight:700;outline:none}.page-jump:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(23,182,176,.14)}.tool-group{display:flex;align-items:center;gap:5px}.tool-btn{min-width:40px;padding:0 10px}.tool-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.tool-btn.primary:hover{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}.zoom-value{min-width:52px;font-size:9px;font-weight:800;color:var(--muted)}
@media(max-width:900px){.reader-stage{padding:6px 44px 4px}.control-dock{gap:6px}.nav-btn{min-width:82px;padding:0 9px}.tool-btn .label{display:none}.tool-btn{min-width:38px;padding:0 8px}.page-jump{display:none}.seek-label{display:none}}
@media(max-width:760px){.reader-shell{grid-template-rows:minmax(0,1fr) 72px}.reader-stage{padding:4px 6px}.edge-arrow{display:none}.turn-hint{bottom:1px;font-size:8px}.control-row{padding:5px}.control-dock{width:100%;gap:5px;padding:6px;border-radius:12px}.nav-btn{min-width:54px;height:36px;padding:0 7px}.nav-btn .word{display:none}.seek-wrap{gap:5px;min-width:90px}.page-status{min-width:46px;font-size:9px}.tool-btn{height:36px;min-width:34px;padding:0 7px}.zoom-value{display:none}.tool-group{gap:3px}}
</style>
</head>
<body>
<div class="reader-shell">
  <main class="reader-stage" id="readerStage">
    <button class="edge-arrow left" id="leftEdge" aria-label="Previous page">‹</button>
    <div class="zoom-space" id="zoomSpace">
      <div class="book-frame" id="bookFrame"><div class="flip-book" id="book">${pageMarkup}</div></div>
    </div>
    <div class="turn-hint" id="turnHint">Drag the hard cover corner to open</div>
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
      <div class="tool-group" aria-label="Zoom controls">
        <button class="tool-btn" id="zoomOutBtn" title="Zoom out" aria-label="Zoom out">−</button>
        <button class="tool-btn zoom-value" id="zoomResetBtn" title="Reset zoom"><span id="zoomValue">100%</span></button>
        <button class="tool-btn" id="zoomInBtn" title="Zoom in" aria-label="Zoom in">+</button>
      </div>
      <button class="tool-btn primary" id="shareBtn" title="Share"><span>↗</span><span class="label">Share</span></button>
      <button class="tool-btn" id="fullBtn" title="Fullscreen" aria-label="Fullscreen">⛶</button>
      <button class="nav-btn next" id="nextBtn"><span class="word">Open</span> →</button>
    </div>
  </footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script>
const DATA=${safeJson(payload)};
const bookEl=document.getElementById('book');
const bookFrame=document.getElementById('bookFrame');
const zoomSpace=document.getElementById('zoomSpace');
const readerStage=document.getElementById('readerStage');
const prevBtn=document.getElementById('prevBtn');
const nextBtn=document.getElementById('nextBtn');
const leftEdge=document.getElementById('leftEdge');
const rightEdge=document.getElementById('rightEdge');
const pageSlider=document.getElementById('pageSlider');
const pageJump=document.getElementById('pageJump');
const pageStatus=document.getElementById('pageStatus');
const turnHint=document.getElementById('turnHint');
const zoomOutBtn=document.getElementById('zoomOutBtn');
const zoomInBtn=document.getElementById('zoomInBtn');
const zoomResetBtn=document.getElementById('zoomResetBtn');
const zoomValue=document.getElementById('zoomValue');
let pageFlip=null;
let currentIndex=0;
let audioCtx=null;
let hintTimer=null;
let zoomLevel=1;
let baseFrameWidth=0;
let baseFrameHeight=0;

function isMobile(){return window.innerWidth<768}

function pageDimensions(){
  const ratio=Math.max(.35,Math.min(1.8,Number(DATA.aspectRatio)||.70710678));
  const mobile=isMobile();
  const maxStageHeight=Math.max(320,window.innerHeight-(mobile?84:92));
  if(mobile){
    let width=Math.min(window.innerWidth-18,520);
    let height=width/ratio;
    if(height>maxStageHeight){height=maxStageHeight;width=height*ratio}
    return {width:Math.max(190,Math.round(width)),height:Math.max(270,Math.round(height)),mobile:true};
  }
  let height=Math.min(maxStageHeight,900);
  let width=height*ratio;
  const maxSpreadWidth=Math.max(620,window.innerWidth-100);
  if(width*2>maxSpreadWidth){width=maxSpreadWidth/2;height=width/ratio}
  return {width:Math.max(280,Math.round(width)),height:Math.max(396,Math.round(height)),mobile:false};
}

function spreadState(){
  try{
    const collection=pageFlip?.getPageCollection?.();
    if(!collection)return null;
    const spreads=collection.getSpread();
    const spreadIndex=collection.getCurrentSpreadIndex();
    const spread=Array.isArray(spreads)&&spreadIndex>=0?spreads[spreadIndex]:null;
    return {spreads,spreadIndex,spread};
  }catch(_){return null}
}

function updateControls(index){
  currentIndex=Math.max(0,Math.min(Math.max(0,DATA.pageCount-1),Number(index)||0));
  if(!DATA.pageCount){
    prevBtn.disabled=true;nextBtn.disabled=true;leftEdge.disabled=true;rightEdge.disabled=true;
    pageSlider.disabled=true;pageJump.disabled=true;pageStatus.textContent='0 / 0';return;
  }
  const state=spreadState();
  const canPrev=state?state.spreadIndex>0:currentIndex>0;
  const canNext=state?state.spreadIndex<state.spreads.length-1:currentIndex<DATA.pageCount-1;
  prevBtn.disabled=!canPrev;leftEdge.disabled=!canPrev;nextBtn.disabled=!canNext;rightEdge.disabled=!canNext;
  nextBtn.innerHTML=currentIndex===0?'<span class="word">Open</span> →':'<span class="word">Next</span> →';
  pageSlider.value=String(currentIndex+1);
  pageJump.value=String(currentIndex+1);
  if(currentIndex===0){
    pageStatus.textContent='Cover';
    if(turnHint)turnHint.textContent='Drag the hard cover corner to open';
  }else if(currentIndex===DATA.pageCount-1){
    pageStatus.textContent='Back cover';
    if(turnHint)turnHint.textContent='Turn back to reopen';
  }else if(state&&Array.isArray(state.spread)&&state.spread.length===2){
    pageStatus.textContent=(state.spread[0]+1)+'–'+(state.spread[1]+1)+' / '+DATA.pageCount;
    if(turnHint)turnHint.textContent='Drag a page corner or swipe to turn';
  }else{
    pageStatus.textContent=(currentIndex+1)+' / '+DATA.pageCount;
    if(turnHint)turnHint.textContent='Drag a page corner or swipe to turn';
  }
  pageSlider.style.setProperty('--progress',DATA.pageCount>1?((currentIndex/(DATA.pageCount-1))*100)+'%':'100%');
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

function applyZoom(next){
  const clamped=Math.max(.75,Math.min(2.25,Math.round(next*20)/20));
  zoomLevel=clamped;
  bookFrame.style.transform='scale('+zoomLevel+')';
  zoomSpace.style.width=Math.ceil(baseFrameWidth*zoomLevel)+'px';
  zoomSpace.style.height=Math.ceil(baseFrameHeight*zoomLevel)+'px';
  zoomValue.textContent=Math.round(zoomLevel*100)+'%';
  zoomOutBtn.disabled=zoomLevel<=.75;
  zoomInBtn.disabled=zoomLevel>=2.25;
  if(zoomLevel===1){readerStage.scrollLeft=0;readerStage.scrollTop=0}
}

function init(){
  if(!DATA.pageCount){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">This flipbook has no pages.</div>';updateControls(0);return}
  if(!window.St||!window.St.PageFlip){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">The page-turn engine could not load. Please refresh.</div>';return}
  const dims=pageDimensions();
  baseFrameWidth=dims.width*(dims.mobile?1:2);
  baseFrameHeight=dims.height;
  bookFrame.style.width=baseFrameWidth+'px';
  bookFrame.style.height=baseFrameHeight+'px';
  zoomSpace.style.width=baseFrameWidth+'px';
  zoomSpace.style.height=baseFrameHeight+'px';
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
    autoSize:false,
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
    bookEl.classList.add('is-ready');
    updateControls(currentIndex);
    applyZoom(1);
  });
  pageFlip.on('flip',e=>{
    currentIndex=Number(e.data)||0;
    updateControls(currentIndex);
    playPageTurnSound();
    hideHint();
  });
  pageFlip.on('changeOrientation',()=>{setTimeout(()=>{try{updateControls(pageFlip.getCurrentPageIndex())}catch(_){}},0)});
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
  zoomOutBtn.onclick=()=>applyZoom(zoomLevel-.25);
  zoomInBtn.onclick=()=>applyZoom(zoomLevel+.25);
  zoomResetBtn.onclick=()=>applyZoom(1);
  document.addEventListener('keydown',e=>{
    if(document.activeElement===pageJump||document.activeElement===pageSlider)return;
    if((e.ctrlKey||e.metaKey)&&e.key==='='){e.preventDefault();applyZoom(zoomLevel+.25);return}
    if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();applyZoom(zoomLevel-.25);return}
    if((e.ctrlKey||e.metaKey)&&e.key==='0'){e.preventDefault();applyZoom(1);return}
    if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();nextBtn.onclick()}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();prevBtn.onclick()}
    if(e.key==='Home'){e.preventDefault();jumpToPage(1)}
    if(e.key==='End'){e.preventDefault();jumpToPage(DATA.pageCount)}
  });
  document.addEventListener('pointerdown',ensureAudio,{once:true});
}

window.addEventListener('load',init,{once:true});
document.getElementById('fullBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
document.getElementById('shareBtn').onclick=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:DATA.title,url});else{await navigator.clipboard.writeText(url);const b=document.getElementById('shareBtn');const old=b.innerHTML;b.textContent='Copied';setTimeout(()=>b.innerHTML=old,1200)}}catch(_){} };
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };
