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
    const payload = {
        title: String(book.title || 'Flipbook'),
        description: String(book.description || ''),
        pageCount,
        token: shareToken,
        pages: Array.from({ length: pageCount }, (_, index) => `/api/scorm/flipbooks/public/${shareToken}/pages/${index}`)
    };

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#f6f2eb">
<title>${title} | LMSGEN Flipbook</title>
<meta name="description" content="${description}">
<style>
:root{--paper:#fffdf9;--canvas:#f4f1eb;--surface:#ffffff;--line:#ded8ce;--ink:#1d252b;--muted:#746f68;--accent:#b9772d;--accent-soft:#f3e4d1;--teal:#127d78;--shadow:rgba(55,45,32,.16)}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Inter,Arial,sans-serif;background:var(--canvas);color:var(--ink)}body{overflow:hidden}.shell{height:100dvh;display:grid;grid-template-rows:auto 1fr;background:linear-gradient(180deg,#fff 0,#f8f6f1 16%,#f2efe9 100%)}
.topbar{height:64px;display:flex;align-items:center;gap:14px;padding:0 22px;background:rgba(255,255,255,.94);border-bottom:1px solid #e6e0d7;box-shadow:0 3px 14px rgba(62,51,37,.05);z-index:30}.brand{font-weight:850;letter-spacing:.16em;font-size:11px;color:var(--teal)}.meta{min-width:0;flex:1}.meta h1{font-size:14px;margin:0;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta p{font-size:10px;margin:4px 0 0;color:#8a847c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tools{display:flex;gap:8px}.icon-btn,.nav-btn{appearance:none;border:1px solid #d9d2c7;background:#fff;color:#544b42;border-radius:11px;height:40px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:750;cursor:pointer;box-shadow:0 3px 10px rgba(68,54,35,.04);transition:.18s ease}.icon-btn:hover,.nav-btn:hover{border-color:#caa77c;background:#fffaf3;color:#9b5f20}.icon-btn:active,.nav-btn:active{transform:translateY(1px)}.icon-btn:disabled,.nav-btn:disabled{opacity:.35;cursor:not-allowed}.icon-btn.primary{background:#fff8ef;border-color:#dfc29f;color:#995b1d}
.stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;padding:20px 76px 94px;overflow:hidden}.book-frame{position:relative;display:flex;align-items:center;justify-content:center;transition:width .3s ease,height .3s ease}.book-host{width:100%;height:100%;touch-action:none;filter:drop-shadow(0 22px 32px rgba(53,43,31,.2));transition:filter .25s ease}.book-frame.is-closed .book-host{filter:drop-shadow(9px 20px 28px rgba(53,43,31,.22))}.book-host canvas{border-radius:4px}.turn-hint{position:absolute;left:50%;bottom:-28px;transform:translateX(-50%);z-index:8;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.88);border:1px solid #e0d9cf;color:#8a8177;font-size:9px;white-space:nowrap;pointer-events:none;transition:opacity .3s ease}.edge-arrow{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:1px solid #ded6ca;background:rgba(255,255,255,.94);color:#9a6124;display:grid;place-items:center;font-size:25px;cursor:pointer;z-index:12;box-shadow:0 8px 22px rgba(68,54,35,.09)}.edge-arrow:hover{background:#fff8ef;border-color:#d9b98f}.edge-arrow:disabled{opacity:.22;cursor:not-allowed}.edge-arrow.left{left:18px}.edge-arrow.right{right:18px}
.control-dock{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:25;display:flex;align-items:center;gap:12px;min-width:min(760px,calc(100vw - 34px));padding:11px 14px;border:1px solid #ded6ca;border-radius:17px;background:rgba(255,255,255,.96);box-shadow:0 12px 34px rgba(65,51,34,.13);backdrop-filter:blur(14px)}.nav-btn{height:42px;min-width:108px}.nav-btn.next{background:#c58a4b;border-color:#c58a4b;color:#fff}.nav-btn.next:hover{background:#b77b3b;color:#fff}.jump-wrap{display:flex;align-items:center;gap:11px;flex:1;min-width:0}.page-slider{appearance:none;width:100%;height:5px;border-radius:999px;background:linear-gradient(to right,#c58a4b 0 var(--progress,0%),#e8e1d7 var(--progress,0%) 100%);outline:none;cursor:pointer}.page-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid #c58a4b;box-shadow:0 2px 6px rgba(80,56,28,.2)}.page-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #c58a4b}.page-count{min-width:54px;text-align:center;color:#a46829;font-size:12px;font-weight:800}.page-jump{width:56px;height:36px;border:1px solid #ddd4c8;border-radius:9px;background:#fff;color:#51483f;text-align:center;font-size:11px;font-weight:700;outline:none}.page-jump:focus{border-color:#c58a4b;box-shadow:0 0 0 3px rgba(197,138,75,.12)}.jump-label{font-size:9px;color:#948a7f;white-space:nowrap}.empty,.fallback{padding:30px;text-align:center;color:#82786e}.fallback img{display:block;max-height:70vh;max-width:min(86vw,720px);margin:0 auto 14px;border-radius:7px;background:#fff;box-shadow:0 18px 38px rgba(58,47,34,.16)}
@media(max-width:760px){.topbar{height:58px;padding:0 12px;gap:9px}.brand{display:none}.meta h1{font-size:13px}.meta p{display:none}.icon-btn{height:36px;min-width:36px;padding:0 10px}.icon-btn .label{display:none}.stage{padding:10px 8px 98px}.edge-arrow{display:none}.turn-hint{bottom:-23px;font-size:8px}.control-dock{bottom:10px;gap:8px;padding:8px 9px;border-radius:14px}.nav-btn{min-width:72px;height:38px;padding:0 9px}.nav-btn span.word{display:none}.jump-wrap{gap:7px}.jump-label{display:none}.page-count{min-width:42px;font-size:10px}.page-jump{display:none}}
@media(max-width:420px){.control-dock{min-width:calc(100vw - 16px)}.nav-btn{min-width:58px}.page-count{min-width:38px}.tools{gap:5px}.icon-btn{padding:0 8px}}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand">LMSGEN</div>
    <div class="meta"><h1>${title}</h1><p>${description || 'Interactive flipbook'}</p></div>
    <div class="tools">
      <button class="icon-btn primary" id="shareBtn" title="Share"><span>↗</span><span class="label">Share</span></button>
      <button class="icon-btn" id="fullBtn" title="Fullscreen"><span>⛶</span></button>
    </div>
  </header>
  <main class="stage" id="stage">
    <button class="edge-arrow left" id="leftEdge" aria-label="Previous page">‹</button>
    <div class="book-frame is-closed" id="bookFrame">
      <div class="book-host" id="book"></div>
      <div class="turn-hint" id="turnHint">Drag the cover corner to open</div>
    </div>
    <button class="edge-arrow right" id="rightEdge" aria-label="Next page">›</button>

    <div class="control-dock">
      <button class="nav-btn" id="prevBtn">← <span class="word">Previous</span></button>
      <div class="jump-wrap">
        <span class="jump-label">Page</span>
        <input id="pageSlider" class="page-slider" type="range" min="1" max="${Math.max(1, pageCount)}" value="1" step="1" aria-label="Jump to page">
        <div class="page-count" id="pageCountLabel">1 / ${Math.max(1, pageCount)}</div>
        <input id="pageJump" class="page-jump" type="number" min="1" max="${Math.max(1, pageCount)}" value="1" aria-label="Go to page number">
      </div>
      <button class="nav-btn next" id="nextBtn"><span class="word">Open</span> →</button>
    </div>
  </main>
</div>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script>
const DATA=${safeJson(payload)};
const bookEl=document.getElementById('book');
const bookFrame=document.getElementById('bookFrame');
const prevBtn=document.getElementById('prevBtn');
const nextBtn=document.getElementById('nextBtn');
const leftEdge=document.getElementById('leftEdge');
const rightEdge=document.getElementById('rightEdge');
const turnHint=document.getElementById('turnHint');
const pageSlider=document.getElementById('pageSlider');
const pageCountLabel=document.getElementById('pageCountLabel');
const pageJump=document.getElementById('pageJump');
let pageFlip=null;
let currentIndex=0;
let hintTimer=null;
let resizeTimer=null;
let frameTimer=null;
let audioCtx=null;
let pendingJump=null;

function isMobile(){return matchMedia('(max-width:760px)').matches}
function isClosedPage(index){return !isMobile()&&(index<=0||index>=Math.max(0,DATA.pageCount-1))}

function fitBookFrame(index,refresh){
  const mobile=isMobile();
  const pageRatio=420/594;
  const safeIndex=Number.isFinite(Number(index))?Number(index):currentIndex;
  const closed=!mobile&&isClosedPage(safeIndex);
  const horizontalRoom=Math.max(260,window.innerWidth-(mobile?16:190));
  const verticalRoom=Math.max(320,window.innerHeight-(mobile?150:172));
  const maxHeight=Math.min(verticalRoom,mobile?720:660);
  const ratio=mobile||closed?pageRatio:pageRatio*2;
  const height=Math.min(maxHeight,horizontalRoom/ratio);
  const width=height*ratio;
  bookFrame.style.width=Math.round(width)+'px';
  bookFrame.style.height=Math.round(height)+'px';
  bookFrame.classList.toggle('is-closed',closed||mobile);
  if(refresh&&pageFlip){
    if(frameTimer)clearTimeout(frameTimer);
    frameTimer=setTimeout(()=>{try{pageFlip.update()}catch(_){}},45);
  }
}

function playPageTurnSound(){
  try{
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return;
    if(!audioCtx)audioCtx=new AudioContextClass();
    const ctx=audioCtx;
    const renderSound=()=>{
      const duration=.24;
      const length=Math.max(1,Math.floor(ctx.sampleRate*duration));
      const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
      const data=buffer.getChannelData(0);
      for(let i=0;i<length;i+=1){
        const t=i/length;
        const envelope=Math.sin(Math.PI*Math.min(1,t*1.5))*Math.pow(1-t,.7);
        data[i]=(Math.random()*2-1)*envelope;
      }
      const source=ctx.createBufferSource();
      const highpass=ctx.createBiquadFilter();
      const lowpass=ctx.createBiquadFilter();
      const gain=ctx.createGain();
      highpass.type='highpass';highpass.frequency.value=650;
      lowpass.type='lowpass';lowpass.frequency.value=5200;
      gain.gain.setValueAtTime(.0001,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.075,ctx.currentTime+.018);
      gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
      source.buffer=buffer;
      source.playbackRate.setValueAtTime(.92+Math.random()*.16,ctx.currentTime);
      source.connect(highpass);highpass.connect(lowpass);lowpass.connect(gain);gain.connect(ctx.destination);
      source.start();source.stop(ctx.currentTime+duration+.02);
    };
    if(ctx.state==='suspended')ctx.resume().then(renderSound).catch(()=>{});else renderSound();
  }catch(_){}
}

function updateControls(index){
  currentIndex=Math.max(0,Math.min(Math.max(0,DATA.pageCount-1),Number(index)||0));
  if(!DATA.pageCount){
    prevBtn.disabled=true;nextBtn.disabled=true;leftEdge.disabled=true;rightEdge.disabled=true;
    pageSlider.disabled=true;pageJump.disabled=true;pageCountLabel.textContent='0 / 0';return;
  }
  const first=currentIndex<=0;
  const last=currentIndex>=DATA.pageCount-1;
  const currentHuman=currentIndex+1;
  prevBtn.disabled=first;leftEdge.disabled=first;nextBtn.disabled=last;rightEdge.disabled=last;
  nextBtn.innerHTML=first?'<span class="word">Open</span> →':'<span class="word">Next</span> →';
  prevBtn.innerHTML=last?'← <span class="word">Open</span>':'← <span class="word">Previous</span>';
  pageSlider.value=String(currentHuman);
  pageJump.value=String(currentHuman);
  pageCountLabel.textContent=currentHuman+' / '+DATA.pageCount;
  pageSlider.style.setProperty('--progress',DATA.pageCount>1?(((currentHuman-1)/(DATA.pageCount-1))*100)+'%':'100%');
  if(turnHint)turnHint.textContent=first?'Drag the cover corner to open':last?'Turn back to reopen':'Drag a page corner or swipe to turn';
}

function hideHint(){
  if(hintTimer)clearTimeout(hintTimer);
  hintTimer=setTimeout(()=>{if(turnHint)turnHint.style.opacity='0'},1500);
}

function jumpToHumanPage(value){
  if(!DATA.pageCount)return;
  const human=Math.max(1,Math.min(DATA.pageCount,Math.round(Number(value)||1)));
  const target=human-1;
  pageSlider.value=String(human);
  pageJump.value=String(human);
  pageCountLabel.textContent=human+' / '+DATA.pageCount;
  pageSlider.style.setProperty('--progress',DATA.pageCount>1?(((human-1)/(DATA.pageCount-1))*100)+'%':'100%');
  if(target===currentIndex)return;
  if(pageFlip){
    try{pageFlip.flip(target,'top')}catch(_){try{pageFlip.turnToPage(target);updateControls(target);fitBookFrame(target,true);playPageTurnSound()}catch(__){}}
  }
}

function fallback(){
  fitBookFrame(0,false);
  if(!DATA.pageCount){bookEl.innerHTML='<div class="empty">This flipbook has no pages.</div>';updateControls(0);return;}
  let index=0;
  const draw=()=>{bookEl.innerHTML='<div class="fallback"><img src="'+DATA.pages[index]+'" alt="Page '+(index+1)+'"><div>Page flip library could not load. Use the navigation controls.</div></div>';updateControls(index);fitBookFrame(index,false)};
  const move=(delta)=>{const next=Math.max(0,Math.min(DATA.pageCount-1,index+delta));if(next===index)return;index=next;playPageTurnSound();draw()};
  const jump=(human)=>{const next=Math.max(0,Math.min(DATA.pageCount-1,Number(human)-1));if(next===index)return;index=next;playPageTurnSound();draw()};
  prevBtn.onclick=()=>move(-1);nextBtn.onclick=()=>move(1);leftEdge.onclick=()=>move(-1);rightEdge.onclick=()=>move(1);
  pageSlider.onchange=()=>jump(pageSlider.value);pageJump.onchange=()=>jump(pageJump.value);draw();
}

function initFlipbook(){
  fitBookFrame(0,false);
  if(!DATA.pageCount){fallback();return;}
  if(!window.St||!window.St.PageFlip){fallback();return;}
  pageFlip=new window.St.PageFlip(bookEl,{
    width:420,
    height:594,
    size:'stretch',
    minWidth:240,
    maxWidth:470,
    minHeight:340,
    maxHeight:665,
    drawShadow:true,
    flippingTime:900,
    usePortrait:true,
    startPage:0,
    autoSize:true,
    maxShadowOpacity:.55,
    showCover:true,
    mobileScrollSupport:false,
    swipeDistance:25,
    clickEventForward:true,
    useMouseEvents:true,
    showPageCorners:true,
    disableFlipByClick:false
  });
  pageFlip.on('init',e=>{
    const index=e.data&&Number.isFinite(e.data.page)?e.data.page:0;
    updateControls(index);fitBookFrame(index,true);
  });
  pageFlip.on('flip',e=>{
    updateControls(e.data);playPageTurnSound();fitBookFrame(Number(e.data),true);hideHint();
  });
  pageFlip.on('changeOrientation',()=>{requestAnimationFrame(()=>{try{const idx=pageFlip.getCurrentPageIndex();updateControls(idx);fitBookFrame(idx,true)}catch(_){}})});
  pageFlip.loadFromImages(DATA.pages);
  updateControls(0);
  const prev=()=>{try{pageFlip.flipPrev('top')}catch(_){}};
  const next=()=>{try{pageFlip.flipNext('top')}catch(_){}};
  prevBtn.onclick=prev;leftEdge.onclick=prev;nextBtn.onclick=next;rightEdge.onclick=next;
  pageSlider.addEventListener('input',()=>{
    const human=Number(pageSlider.value)||1;
    pageCountLabel.textContent=human+' / '+DATA.pageCount;
    pageJump.value=String(human);
    pageSlider.style.setProperty('--progress',DATA.pageCount>1?(((human-1)/(DATA.pageCount-1))*100)+'%':'100%');
  });
  pageSlider.addEventListener('change',()=>jumpToHumanPage(pageSlider.value));
  pageJump.addEventListener('change',()=>jumpToHumanPage(pageJump.value));
  pageJump.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();jumpToHumanPage(pageJump.value);pageJump.blur()}});
  document.addEventListener('keydown',e=>{
    if(document.activeElement===pageJump||document.activeElement===pageSlider)return;
    if(['ArrowRight','PageDown'].includes(e.key))next();
    if(['ArrowLeft','PageUp'].includes(e.key))prev();
    if(e.key==='Home')jumpToHumanPage(1);
    if(e.key==='End')jumpToHumanPage(DATA.pageCount);
  });
  window.addEventListener('resize',()=>{
    if(resizeTimer)clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>fitBookFrame(currentIndex,true),90);
  },{passive:true});
}

window.addEventListener('load',initFlipbook,{once:true});
document.getElementById('fullBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
document.getElementById('shareBtn').onclick=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:DATA.title,url});else{await navigator.clipboard.writeText(url);const b=document.getElementById('shareBtn');const old=b.innerHTML;b.textContent='Copied';setTimeout(()=>b.innerHTML=old,1200)}}catch(_){}};
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };
