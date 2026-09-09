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
<meta name="theme-color" content="#07111f">
<title>${title} | LMSGEN Flipbook</title>
<meta name="description" content="${description}">
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Inter,Arial,sans-serif;background:#07111f;color:#eef7ff}body{overflow:hidden}.shell{height:100dvh;display:grid;grid-template-rows:auto 1fr auto;background:radial-gradient(circle at top,#10263a 0,#07111f 43%,#040a12 100%)}.topbar,.bottombar{display:flex;align-items:center;gap:12px;padding:12px 18px;background:rgba(4,10,18,.88);backdrop-filter:blur(16px);z-index:20}.topbar{border-bottom:1px solid rgba(148,163,184,.16)}.brand{font-weight:800;letter-spacing:.14em;font-size:12px;color:#7de2d6}.meta{min-width:0;flex:1}.meta h1{font-size:14px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta p{font-size:11px;margin:3px 0 0;color:#8da2ba;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tools{display:flex;gap:8px}.btn{appearance:none;border:1px solid rgba(125,226,214,.24);background:#0b1d2b;color:#dffdfa;border-radius:10px;min-width:38px;height:38px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:700;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .18s ease}.btn:hover{background:#103044;border-color:rgba(125,226,214,.42)}.btn:active{transform:translateY(1px)}.btn:disabled{opacity:.35;cursor:not-allowed}.stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;padding:18px 72px 22px;overflow:hidden}.book-frame{position:relative;width:min(86vw,980px);aspect-ratio:1.414/1;display:flex;align-items:center;justify-content:center}.book-host{width:100%;height:100%;filter:drop-shadow(0 30px 50px rgba(0,0,0,.48));touch-action:none}.book-host canvas{border-radius:4px}.turn-hint{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);z-index:6;padding:7px 11px;border:1px solid rgba(148,163,184,.18);border-radius:999px;background:rgba(4,10,18,.72);color:#9fb4c9;font-size:10px;pointer-events:none;opacity:.86;transition:opacity .3s ease}.edge-arrow{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:1px solid rgba(125,226,214,.2);background:rgba(9,25,38,.86);color:#dffdfa;display:grid;place-items:center;font-size:24px;cursor:pointer;z-index:12;box-shadow:0 12px 30px rgba(0,0,0,.24)}.edge-arrow:hover{background:#103044}.edge-arrow:disabled{opacity:.25;cursor:not-allowed}.edge-arrow.left{left:14px}.edge-arrow.right{right:14px}.bottombar{justify-content:center;border-top:1px solid rgba(148,163,184,.16);position:relative}.status{min-width:150px;text-align:center;color:#a9bdd0;font-size:12px}.progress{height:3px;position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.08)}.progress span{display:block;height:100%;background:#63d7ca;transition:width .35s ease}.empty,.fallback{padding:30px;text-align:center;color:#aec3d6}.fallback img{display:block;max-height:72vh;max-width:min(88vw,760px);margin:0 auto 14px;border-radius:8px;background:#fff;box-shadow:0 24px 44px rgba(0,0,0,.35)}
@media(max-width:760px){body{overflow:hidden}.topbar{padding:10px 12px}.brand{display:none}.meta h1{font-size:13px}.meta p{display:none}.tools .label{display:none}.btn{padding:0 10px}.stage{padding:8px 8px 14px}.book-frame{width:min(92vw,520px);aspect-ratio:.707/1}.book-host{filter:drop-shadow(0 18px 30px rgba(0,0,0,.4))}.edge-arrow{display:none}.turn-hint{bottom:4px;font-size:9px;padding:6px 9px}.bottombar{padding:9px 10px}.status{min-width:100px}.fallback img{max-height:calc(100dvh - 180px);max-width:94vw}}
@media(max-width:420px){.topbar{gap:8px}.btn{height:36px;min-width:36px}.tools{gap:6px}.bottombar{gap:8px}.status{font-size:11px}}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div class="brand">LMSGEN</div>
    <div class="meta"><h1>${title}</h1><p>${description || 'Interactive flipbook'}</p></div>
    <div class="tools">
      <button class="btn" id="shareBtn" title="Share"><span>↗</span><span class="label">Share</span></button>
      <button class="btn" id="fullBtn" title="Fullscreen"><span>⛶</span></button>
    </div>
  </header>
  <main class="stage" id="stage">
    <button class="edge-arrow left" id="leftEdge" aria-label="Previous page">‹</button>
    <div class="book-frame" id="bookFrame">
      <div class="book-host" id="book"></div>
      <div class="turn-hint" id="turnHint">Drag a page corner or swipe to turn</div>
    </div>
    <button class="edge-arrow right" id="rightEdge" aria-label="Next page">›</button>
  </main>
  <footer class="bottombar">
    <button class="btn" id="prevBtn">← <span>Previous</span></button>
    <div class="status" id="status">Loading…</div>
    <button class="btn" id="nextBtn"><span>Next</span> →</button>
    <div class="progress"><span id="progress"></span></div>
  </footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script>
const DATA=${safeJson(payload)};
const bookEl=document.getElementById('book');
const bookFrame=document.getElementById('bookFrame');
const statusEl=document.getElementById('status');
const progressEl=document.getElementById('progress');
const prevBtn=document.getElementById('prevBtn');
const nextBtn=document.getElementById('nextBtn');
const leftEdge=document.getElementById('leftEdge');
const rightEdge=document.getElementById('rightEdge');
const turnHint=document.getElementById('turnHint');
let pageFlip=null;
let currentIndex=0;
let hintTimer=null;
let resizeTimer=null;

function fitBookFrame(){
  const mobile=matchMedia('(max-width:760px)').matches;
  const pageRatio=420/594;
  const horizontalRoom=Math.max(260,window.innerWidth-(mobile?16:180));
  const verticalRoom=Math.max(320,window.innerHeight-(mobile?136:176));
  const maxHeight=Math.min(verticalRoom,mobile?760:690);
  if(mobile){
    const height=Math.min(maxHeight,horizontalRoom/pageRatio);
    const width=height*pageRatio;
    bookFrame.style.width=Math.round(width)+'px';
    bookFrame.style.height=Math.round(height)+'px';
  }else{
    const spreadRatio=pageRatio*2;
    const height=Math.min(maxHeight,horizontalRoom/spreadRatio);
    const width=height*spreadRatio;
    bookFrame.style.width=Math.round(width)+'px';
    bookFrame.style.height=Math.round(height)+'px';
  }
}

function updateControls(index){
  currentIndex=Math.max(0,Math.min(DATA.pageCount-1,Number(index)||0));
  if(!DATA.pageCount){statusEl.textContent='0 pages';progressEl.style.width='0%';prevBtn.disabled=true;nextBtn.disabled=true;leftEdge.disabled=true;rightEdge.disabled=true;return;}
  statusEl.textContent='Page '+(currentIndex+1)+' of '+DATA.pageCount;
  progressEl.style.width=(((currentIndex+1)/DATA.pageCount)*100)+'%';
  const first=currentIndex<=0;
  const last=currentIndex>=DATA.pageCount-1;
  prevBtn.disabled=first;leftEdge.disabled=first;nextBtn.disabled=last;rightEdge.disabled=last;
}

function hideHint(){
  if(hintTimer)clearTimeout(hintTimer);
  hintTimer=setTimeout(()=>{if(turnHint)turnHint.style.opacity='0';},1400);
}

function fallback(){
  if(!DATA.pageCount){bookEl.innerHTML='<div class="empty">This flipbook has no pages.</div>';updateControls(0);return;}
  let index=0;
  const draw=()=>{bookEl.innerHTML='<div class="fallback"><img src="'+DATA.pages[index]+'" alt="Page '+(index+1)+'"><div>Page flip library could not load. Use Previous and Next.</div></div>';updateControls(index)};
  const move=(delta)=>{index=Math.max(0,Math.min(DATA.pageCount-1,index+delta));draw()};
  prevBtn.onclick=()=>move(-1);nextBtn.onclick=()=>move(1);leftEdge.onclick=()=>move(-1);rightEdge.onclick=()=>move(1);draw();
}

function initFlipbook(){
  fitBookFrame();
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
    flippingTime:850,
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
  pageFlip.on('init',e=>{updateControls(e.data&&Number.isFinite(e.data.page)?e.data.page:0)});
  pageFlip.on('flip',e=>{updateControls(e.data);hideHint()});
  pageFlip.on('changeOrientation',()=>{requestAnimationFrame(()=>{try{updateControls(pageFlip.getCurrentPageIndex())}catch(_){}})});
  pageFlip.loadFromImages(DATA.pages);
  updateControls(0);
  const prev=()=>{try{pageFlip.flipPrev('top')}catch(_){}};
  const next=()=>{try{pageFlip.flipNext('top')}catch(_){}};
  prevBtn.onclick=prev;leftEdge.onclick=prev;nextBtn.onclick=next;rightEdge.onclick=next;
  document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown'].includes(e.key))next();if(['ArrowLeft','PageUp'].includes(e.key))prev()});
  window.addEventListener('resize',()=>{
    if(resizeTimer)clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{fitBookFrame();window.dispatchEvent(new Event('resize'));},80);
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
