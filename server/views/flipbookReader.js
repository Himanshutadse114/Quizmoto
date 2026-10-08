const readerStyles = require('./flipbookReaderStyles');
const shareRuntime = require('./flipbookShareRuntime');

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

function renderFlipbookReader(book, { publicUrl = '' } = {}) {
    const pageCount = Math.max(0, Number(book.pageCount || 0));
    const shareToken = String(book.shareToken || '');
    const title = escapeHtml(book.title || 'Publication');
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
        title: String(book.title || 'Publication'),
        description: String(book.description || ''),
        pageCount,
        token: shareToken,
        shareUrl: String(publicUrl || ''),
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
<meta name="theme-color" content="#080F18">
<title>${title} | LMSGEN Publica</title>
<meta name="description" content="${description}">
<style>
${readerStyles}
</style>
</head>
<body>
<div class="reader-shell">
  <div class="protection-toast" id="protectionToast" role="status">This is a protected Publica publication.</div>
  <div class="protection-toast" id="shareStatus" role="status" aria-live="polite" aria-atomic="true"></div>
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
      <button class="nav-btn" id="prevBtn"><span class="word">Previous</span></button>
      <div class="seek-wrap">
        <span class="seek-label">Page</span>
        <input id="pageSlider" class="page-slider" type="range" min="1" max="${Math.max(1, pageCount)}" value="1" step="1" aria-label="Jump to page">
        <div class="page-status" id="pageStatus" role="status" aria-live="polite">Cover</div>
        <input id="pageJump" class="page-jump" type="number" min="1" max="${Math.max(1, pageCount)}" value="1" aria-label="Go to page number">
      </div>
      <div class="tool-group" aria-label="Zoom controls">
        <button class="tool-btn" id="zoomOutBtn" title="Zoom out" aria-label="Zoom out"><span>−</span><span class="mobile-label">Zoom</span></button>
        <button class="tool-btn zoom-value" id="zoomResetBtn" title="Reset zoom" aria-label="Reset zoom"><span id="zoomValue">100%</span></button>
        <button class="tool-btn" id="zoomInBtn" title="Zoom in" aria-label="Zoom in"><span class="mobile-label">Zoom</span><span>+</span></button>
      </div>
      <button class="tool-btn" id="shareBtn" title="Share" aria-label="Share publication"><span class="label">Share</span></button>
      <button class="tool-btn" id="fullBtn" title="Fullscreen" aria-label="Fullscreen"><span class="label">Full screen</span></button>
      <button class="nav-btn next" id="nextBtn"><span class="word">Open</span></button>
    </div>
  </footer>
  <button class="mobile-fullscreen-exit" id="mobileFullscreenExit" type="button" aria-label="Exit fullscreen">×</button>
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
const fullBtn=document.getElementById('fullBtn');
const mobileFullscreenExit=document.getElementById('mobileFullscreenExit');
const protectionToast=document.getElementById('protectionToast');
let pageFlip=null;
let currentIndex=0;
let audioCtx=null;
let hintTimer=null;
let zoomLevel=1;
let baseFrameWidth=0;
let baseFrameHeight=0;
let pseudoFullscreen=false;
let presentationScale=1;
const PAGE_STATE_KEY='lmsgen-publica-page:'+DATA.token;
let lastSinglePageMode=null;

function isMobile(){return window.innerWidth<768}
let protectionTimer=null;
function showProtectionNotice(){
  protectionToast?.classList.add('is-visible');
  if(protectionTimer)clearTimeout(protectionTimer);
  protectionTimer=setTimeout(()=>protectionToast?.classList.remove('is-visible'),1600);
}
document.addEventListener('contextmenu',e=>{e.preventDefault();showProtectionNotice()});
document.addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('selectstart',e=>e.preventDefault());
window.addEventListener('beforeprint',showProtectionNotice);
function isTouchTablet(){
  const touch=Number(navigator.maxTouchPoints||0)>0||('ontouchstart' in window);
  return touch&&window.innerWidth>=768&&window.innerWidth<=1180;
}
function useSinglePage(){return isMobile()||(isTouchTablet()&&window.innerHeight>=window.innerWidth)}

function stageSize(){
  const style=getComputedStyle(readerStage);
  const horizontal=(parseFloat(style.paddingLeft)||0)+(parseFloat(style.paddingRight)||0);
  const vertical=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
  return {width:Math.max(1,readerStage.clientWidth-horizontal-2),height:Math.max(1,readerStage.clientHeight-vertical-2)};
}
function pageDimensions(){
  const ratio=Math.max(.35,Math.min(1.8,Number(DATA.aspectRatio)||.70710678));
  const mobile=useSinglePage();
  const available=stageSize();
  const maxStageHeight=available.height;
  if(mobile){
    let width=Math.min(available.width,isTouchTablet()?720:520);
    let height=width/ratio;
    if(height>maxStageHeight){height=maxStageHeight;width=height*ratio}
    return {width:Math.max(1,Math.floor(width)),height:Math.max(1,Math.floor(height)),mobile:true};
  }
  let height=Math.min(maxStageHeight,900);
  let width=height*ratio;
  const maxSpreadWidth=available.width;
  if(width*2>maxSpreadWidth){width=maxSpreadWidth/2;height=width/ratio}
  return {width:Math.max(1,Math.floor(width)),height:Math.max(1,Math.floor(height)),mobile:false};
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
  nextBtn.innerHTML=currentIndex===0?'<span class="word">Open</span>':'<span class="word">Next</span>';
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

function renderBookScale(){
  bookFrame.style.transform='scale('+(zoomLevel*presentationScale)+')';
}

function applyZoom(next){
  const clamped=Math.max(.75,Math.min(2.25,Math.round(next*20)/20));
  zoomLevel=clamped;
  updatePresentationScale();
  zoomValue.textContent=Math.round(zoomLevel*100)+'%';
  zoomOutBtn.disabled=zoomLevel<=.75;
  zoomInBtn.disabled=zoomLevel>=2.25;
  if(zoomLevel===1){readerStage.scrollLeft=0;readerStage.scrollTop=0}
}

function init(){
  if(!DATA.pageCount){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">This publication has no pages.</div>';updateControls(0);return}
  if(!window.St||!window.St.PageFlip){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">The page-turn engine could not load. Please refresh.</div>';return}
  const dims=pageDimensions();
  baseFrameWidth=dims.width*(dims.mobile?1:2);
  baseFrameHeight=dims.height;
  bookFrame.style.width=baseFrameWidth+'px';
  bookFrame.style.height=baseFrameHeight+'px';
  zoomSpace.style.width=baseFrameWidth+'px';
  zoomSpace.style.height=baseFrameHeight+'px';
  let rememberedPage=0;
  try{rememberedPage=Math.max(0,Math.min(DATA.pageCount-1,Number(sessionStorage.getItem(PAGE_STATE_KEY))||0))}catch(_){}
  lastSinglePageMode=dims.mobile;
  pageFlip=new window.St.PageFlip(bookEl,{
    width:dims.width,
    height:dims.height,
    size:'fixed',
    minWidth:dims.width,
    maxWidth:dims.width,
    minHeight:dims.height,
    maxHeight:dims.height,
    drawShadow:true,
    flippingTime:window.matchMedia('(prefers-reduced-motion: reduce)').matches?1:900,
    usePortrait:dims.mobile,
    startPage:rememberedPage,
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
    try{sessionStorage.setItem(PAGE_STATE_KEY,String(currentIndex))}catch(_){}
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
    const blocked=(e.ctrlKey||e.metaKey)&&['s','p','u'].includes(String(e.key||'').toLowerCase());
    const devtools=(e.ctrlKey||e.metaKey)&&e.shiftKey&&['i','j','c'].includes(String(e.key||'').toLowerCase());
    if(blocked||devtools||e.key==='PrintScreen'){e.preventDefault();showProtectionNotice();return}
    if(document.activeElement?.matches('input,textarea,select')||document.getElementById('lmsgenReaderGate')&&!document.getElementById('lmsgenReaderGate').classList.contains('is-hidden'))return;
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
function nativeFullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null}
function fullscreenActive(){return Boolean(nativeFullscreenElement())||pseudoFullscreen}
function updatePresentationScale(){
  if(fullscreenActive()&&(isMobile()||isTouchTablet())&&baseFrameWidth>0&&baseFrameHeight>0){
    const fit=Math.min(window.innerWidth/baseFrameWidth,window.innerHeight/baseFrameHeight);
    presentationScale=Math.max(.1,Math.min(4,fit/zoomLevel));
  }else if(baseFrameWidth>0&&baseFrameHeight>0){
    const available=stageSize();
    presentationScale=Math.max(.01,Math.min(1,available.width/baseFrameWidth,available.height/baseFrameHeight));
  }else presentationScale=1;
  renderBookScale();
  zoomSpace.style.width=Math.ceil(baseFrameWidth*zoomLevel*presentationScale)+'px';
  zoomSpace.style.height=Math.ceil(baseFrameHeight*zoomLevel*presentationScale)+'px';
  readerStage.classList.toggle('is-zoomed',zoomLevel>1&&!fullscreenActive());
}
function syncFullscreen(){
  const active=fullscreenActive();
  document.documentElement.classList.toggle('reader-fullscreen',active);
  fullBtn.setAttribute('aria-label',active?'Exit fullscreen':'Fullscreen');
  fullBtn.querySelector('.label').textContent=active?'Exit':'Full screen';
  updatePresentationScale();
  window.setTimeout(()=>{updatePresentationScale();window.dispatchEvent(new Event('resize'))},60);
  window.setTimeout(updatePresentationScale,250);
}
async function leaveFullscreen(){
  pseudoFullscreen=false;
  try{
    if(nativeFullscreenElement()){
      if(document.exitFullscreen)await document.exitFullscreen();
      else if(document.webkitExitFullscreen)await document.webkitExitFullscreen();
    }
  }catch(_){}
  syncFullscreen();
}
fullBtn.onclick=async()=>{
  if(fullscreenActive()){await leaveFullscreen();return}
  if(isMobile()){
    try{
      if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else if(document.documentElement.webkitRequestFullscreen)await document.documentElement.webkitRequestFullscreen();
      else pseudoFullscreen=true;
    }catch(_){pseudoFullscreen=true}
  }else{
    try{
      if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
      else if(document.documentElement.webkitRequestFullscreen)await document.documentElement.webkitRequestFullscreen();
    }catch(_){}
  }
  syncFullscreen();
};
mobileFullscreenExit.onclick=leaveFullscreen;
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('webkitfullscreenchange',syncFullscreen);
let tabletResizeTimer=null;
window.addEventListener('resize',()=>{
  updatePresentationScale();
  if(lastSinglePageMode===null||useSinglePage()===lastSinglePageMode)return;
  if(tabletResizeTimer)clearTimeout(tabletResizeTimer);
  tabletResizeTimer=setTimeout(()=>{
    try{sessionStorage.setItem(PAGE_STATE_KEY,String(currentIndex))}catch(_){}
    location.reload();
  },180);
});
${shareRuntime}
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };
