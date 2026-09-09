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
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Inter,Arial,sans-serif;background:#07111f;color:#eef7ff}body{overflow:hidden}.shell{height:100dvh;display:grid;grid-template-rows:auto 1fr auto;background:radial-gradient(circle at top,#10263a 0,#07111f 42%,#040a12 100%)}.topbar,.bottombar{display:flex;align-items:center;gap:12px;padding:12px 18px;background:rgba(4,10,18,.86);backdrop-filter:blur(16px);z-index:10}.topbar{border-bottom:1px solid rgba(148,163,184,.16)}.brand{font-weight:800;letter-spacing:.14em;font-size:12px;color:#7de2d6}.meta{min-width:0;flex:1}.meta h1{font-size:14px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.meta p{font-size:11px;margin:3px 0 0;color:#8da2ba;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tools{display:flex;gap:8px}.btn{appearance:none;border:1px solid rgba(125,226,214,.24);background:#0b1d2b;color:#dffdfa;border-radius:10px;min-width:38px;height:38px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:12px;font-weight:700;cursor:pointer}.btn:hover{background:#103044}.btn:disabled{opacity:.35;cursor:not-allowed}.stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;padding:24px;overflow:hidden}.book{height:min(78vh,820px);max-height:100%;display:flex;align-items:stretch;justify-content:center;filter:drop-shadow(0 26px 45px rgba(0,0,0,.45));perspective:1800px}.page{height:100%;aspect-ratio:.707/1;background:#fff;overflow:hidden;position:relative}.page:first-child{border-radius:12px 0 0 12px;transform-origin:right center}.page:last-child{border-radius:0 12px 12px 0;transform-origin:left center}.page img{width:100%;height:100%;display:block;object-fit:contain;background:#fff}.page.blank{background:linear-gradient(135deg,#f8fafc,#e2e8f0)}.spine{width:2px;background:linear-gradient(to bottom,rgba(0,0,0,.14),rgba(255,255,255,.25),rgba(0,0,0,.18));box-shadow:0 0 18px rgba(0,0,0,.45);z-index:2}.turn-next{animation:turnNext .28s ease}.turn-prev{animation:turnPrev .28s ease}@keyframes turnNext{0%{transform:rotateY(0)}50%{transform:rotateY(-8deg)}100%{transform:rotateY(0)}}@keyframes turnPrev{0%{transform:rotateY(0)}50%{transform:rotateY(8deg)}100%{transform:rotateY(0)}}.edge{position:absolute;top:0;bottom:0;width:14%;border:0;background:transparent;cursor:pointer;z-index:4}.edge.left{left:0}.edge.right{right:0}.bottombar{justify-content:center;border-top:1px solid rgba(148,163,184,.16)}.status{min-width:120px;text-align:center;color:#a9bdd0;font-size:12px}.progress{height:3px;position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.08)}.progress span{display:block;height:100%;background:#63d7ca;transition:width .25s ease}.empty{padding:30px;text-align:center;color:#aec3d6}.mobile-only{display:none}
@media(max-width:760px){body{overflow:auto}.shell{min-height:100dvh}.topbar{padding:10px 12px}.brand{display:none}.meta h1{font-size:13px}.meta p{display:none}.tools .label{display:none}.btn{padding:0 10px}.stage{padding:10px 12px 14px}.book{height:auto;width:min(100%,520px);max-height:calc(100dvh - 132px)}.page{width:100%;height:auto;aspect-ratio:.707/1;border-radius:10px!important}.page img{height:auto;aspect-ratio:.707/1;object-fit:contain}.desktop-extra,.spine{display:none}.mobile-only{display:inline-flex}.bottombar{padding:9px 10px}.status{min-width:92px}.edge{width:22%}}
@media(max-width:420px){.stage{padding:8px}.topbar{gap:8px}.btn{height:36px;min-width:36px}.tools{gap:6px}.bottombar{gap:8px}}
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
    <button class="edge left" id="leftEdge" aria-label="Previous page"></button>
    <div class="book" id="book"></div>
    <button class="edge right" id="rightEdge" aria-label="Next page"></button>
  </main>
  <footer class="bottombar">
    <button class="btn" id="prevBtn">← <span>Previous</span></button>
    <div class="status" id="status">Loading…</div>
    <button class="btn" id="nextBtn"><span>Next</span> →</button>
    <div class="progress"><span id="progress"></span></div>
  </footer>
</div>
<script>
const DATA=${safeJson(payload)};
let start=0, mobile=matchMedia('(max-width:760px)').matches, touchX=null, anim='';
const book=document.getElementById('book'), statusEl=document.getElementById('status'), progressEl=document.getElementById('progress');
const prevBtn=document.getElementById('prevBtn'), nextBtn=document.getElementById('nextBtn');
function lastStart(){if(!DATA.pageCount)return 0;return mobile?Math.max(0,DATA.pageCount-1):Math.max(0,Math.floor((DATA.pageCount-1)/2)*2)}
function img(index,extra=''){if(index<0||index>=DATA.pageCount)return '<div class="page blank '+extra+'"></div>';return '<div class="page '+extra+' '+anim+'"><img draggable="false" alt="Page '+(index+1)+'" src="'+DATA.pages[index]+'"></div>'}
function render(){start=Math.max(0,Math.min(start,lastStart()));if(!DATA.pageCount){book.innerHTML='<div class="empty">This flipbook has no pages.</div>';statusEl.textContent='0 pages';return}if(mobile){book.innerHTML=img(start)}else{book.innerHTML=img(start)+ '<div class="spine"></div>'+img(start+1,'desktop-extra')}const end=mobile?start+1:Math.min(DATA.pageCount,start+2);statusEl.textContent=mobile?'Page '+(start+1)+' of '+DATA.pageCount:'Pages '+(start+1)+(end>start+1?'–'+end:'')+' of '+DATA.pageCount;progressEl.style.width=((end/DATA.pageCount)*100)+'%';prevBtn.disabled=start<=0;nextBtn.disabled=start>=lastStart();setTimeout(()=>{anim=''},300)}
function move(delta){const step=mobile?1:2;const next=Math.max(0,Math.min(lastStart(),start+delta*step));if(next===start)return;anim=delta>0?'turn-next':'turn-prev';start=next;render()}
prevBtn.onclick=()=>move(-1);nextBtn.onclick=()=>move(1);document.getElementById('leftEdge').onclick=()=>move(-1);document.getElementById('rightEdge').onclick=()=>move(1);
document.addEventListener('keydown',e=>{if(['ArrowRight','PageDown'].includes(e.key))move(1);if(['ArrowLeft','PageUp'].includes(e.key))move(-1)});
const stage=document.getElementById('stage');stage.addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX},{passive:true});stage.addEventListener('touchend',e=>{if(touchX===null)return;const dx=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(dx)>45)move(dx<0?1:-1)},{passive:true});
addEventListener('resize',()=>{const now=matchMedia('(max-width:760px)').matches;if(now!==mobile){mobile=now;start=mobile?Math.min(start,DATA.pageCount-1):Math.floor(start/2)*2;render()}});
document.getElementById('fullBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
document.getElementById('shareBtn').onclick=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title:DATA.title,url});else{await navigator.clipboard.writeText(url);const b=document.getElementById('shareBtn');const old=b.innerHTML;b.textContent='Copied';setTimeout(()=>b.innerHTML=old,1200)}}catch(_){}};
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
render();
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };
