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
        pageCount,
        token: shareToken,
        aspectRatio,
        publicUrl: `https://www.lmsgen.in/flipbook/${encodeURIComponent(shareToken)}`
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
:root{--canvas:#f4fbfa;--surface:#fff;--line:#d7ece8;--ink:#17313a;--muted:#6a8588;--accent:#17b6b0;--accent-dark:#0f9a95;--accent-soft:#e8f8f7}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font-family:Inter,Arial,sans-serif;background:var(--canvas);color:var(--ink)}body{overflow:hidden}
.reader-shell{height:100dvh;display:grid;grid-template-rows:minmax(0,1fr) 78px;background:linear-gradient(180deg,#fff 0,#f7fcfb 10%,#eef8f7 100%);transition:background .25s ease}
.reader-stage{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;padding:8px 56px 6px;transition:padding .25s ease}
.zoom-space{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto}.book-frame{display:flex;align-items:center;justify-content:center;overflow:visible;transform-origin:center center;transition:transform .22s cubic-bezier(.2,.8,.2,1)}
.flip-book{opacity:0;transition:opacity .18s ease;filter:drop-shadow(0 24px 38px rgba(23,49,58,.18))}.flip-book.is-ready{opacity:1}.book-page{background:#fff;overflow:hidden}.book-page img{display:block;width:100%;height:100%;object-fit:contain;background:#fff}.front-cover-page,.back-cover-page{box-shadow:inset 0 0 24px rgba(23,49,58,.08)}
.turn-hint{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.94);color:var(--muted);font-size:9px;white-space:nowrap;pointer-events:none;transition:opacity .3s ease;z-index:10}
.edge-arrow{position:fixed;top:50%;transform:translateY(-50%);width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.97);color:var(--accent-dark);display:grid;place-items:center;font-size:25px;cursor:pointer;z-index:12;box-shadow:0 8px 22px rgba(23,49,58,.09);transition:opacity .22s ease,background .18s ease}.edge-arrow.left{left:16px}.edge-arrow.right{right:16px}.edge-arrow:hover{background:var(--accent-soft);border-color:var(--accent)}.edge-arrow:disabled{opacity:.2;cursor:not-allowed}.empty{padding:36px;text-align:center;color:var(--muted)}
.control-row{display:flex;align-items:center;justify-content:center;padding:7px 12px 11px;background:linear-gradient(180deg,rgba(244,251,250,0),var(--canvas) 28%);transition:opacity .24s ease,transform .24s ease,background .25s ease}
.control-dock{width:min(1120px,calc(100vw - 20px));display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:15px;background:rgba(255,255,255,.985);box-shadow:0 10px 30px rgba(23,49,58,.1);transition:background .25s ease,border-color .25s ease}
.nav-btn,.tool-btn{appearance:none;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;height:40px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:10px;font-weight:750;cursor:pointer;white-space:nowrap;transition:background .18s ease,border-color .18s ease,color .18s ease,transform .12s ease}.nav-btn:hover,.tool-btn:hover{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-dark)}.nav-btn:active,.tool-btn:active{transform:translateY(1px)}.nav-btn:disabled,.tool-btn:disabled{opacity:.3;cursor:not-allowed}.nav-btn{min-width:102px}.nav-btn.next,.tool-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.nav-btn.next:hover,.tool-btn.primary:hover{background:var(--accent-dark);border-color:var(--accent-dark);color:#fff}
.seek-wrap{display:flex;align-items:center;gap:8px;flex:1;min-width:160px}.seek-label{font-size:9px;color:var(--muted)}.page-slider{appearance:none;width:100%;height:5px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--progress,0%),#dfeceb var(--progress,0%) 100%);outline:none;cursor:pointer}.page-slider::-webkit-slider-thumb{appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--accent)}.page-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--accent)}.page-status{min-width:78px;text-align:center;color:var(--accent-dark);font-size:10px;font-weight:800;white-space:nowrap}.page-jump{width:52px;height:34px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink);text-align:center;font-size:10px;font-weight:700;outline:none}.page-jump:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(23,182,176,.14)}
.zoom-tools{display:flex;align-items:center;gap:5px}.tool-btn{min-width:40px}.zoom-value{min-width:52px;color:var(--muted)}.sound-btn.is-muted{color:#9aaeb0;background:#f5f8f8}.fullscreen-prompt{position:fixed;left:50%;bottom:92px;transform:translate(-50%,10px);z-index:50;padding:9px 14px;border-radius:999px;background:rgba(4,11,13,.78);color:#fff;font-size:11px;font-weight:700;opacity:0;pointer-events:none;transition:.25s ease}
.reader-shell.is-fullscreen{grid-template-rows:1fr;background:radial-gradient(circle at 50% 42%,#26373b 0,#121b1e 52%,#080d0f 100%)}.reader-shell.is-fullscreen .reader-stage{padding:20px 72px 76px}.reader-shell.is-fullscreen .flip-book{filter:drop-shadow(0 34px 52px rgba(0,0,0,.52))}.reader-shell.is-fullscreen .control-row{position:fixed;left:0;right:0;bottom:0;z-index:40;padding:16px 18px 18px;background:linear-gradient(180deg,transparent,rgba(3,9,11,.82))}.reader-shell.is-fullscreen .control-dock{background:rgba(8,17,20,.82);border-color:rgba(255,255,255,.14);backdrop-filter:blur(18px);box-shadow:0 14px 44px rgba(0,0,0,.35)}.reader-shell.is-fullscreen .nav-btn,.reader-shell.is-fullscreen .tool-btn,.reader-shell.is-fullscreen .page-jump{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.16);color:#eef9f8}.reader-shell.is-fullscreen .nav-btn.next,.reader-shell.is-fullscreen .tool-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}.reader-shell.is-fullscreen .page-status{color:#8fe2dc}.reader-shell.is-fullscreen .fullscreen-prompt.is-visible{opacity:1;transform:translate(-50%,0)}.reader-shell.is-fullscreen.controls-hidden{cursor:none}.reader-shell.is-fullscreen.controls-hidden .control-row{opacity:0;transform:translateY(18px);pointer-events:none}.reader-shell.is-fullscreen.controls-hidden .edge-arrow,.reader-shell.is-fullscreen.controls-hidden .turn-hint{opacity:0;pointer-events:none}
@media(max-width:900px){.reader-stage{padding:6px 44px 4px}.control-dock{gap:6px}.nav-btn{min-width:82px}.page-jump{display:none}.seek-label{display:none}}
@media(max-width:760px){.reader-shell{grid-template-rows:minmax(0,1fr) 176px}.reader-stage{padding:6px 8px 3px}.edge-arrow{display:none}.turn-hint{bottom:2px;font-size:9px}.control-row{padding:7px;align-items:stretch}.control-dock{width:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-areas:"prev next" "seek seek" "sound full" "share share";gap:8px;padding:10px;border-radius:17px}#prevBtn{grid-area:prev}#nextBtn{grid-area:next}.nav-btn{min-width:0;width:100%;height:42px;font-size:12px}.seek-wrap{grid-area:seek;display:grid;grid-template-columns:68px 1fr;grid-template-areas:"jump status" "slider slider";gap:6px 8px;min-width:0}.seek-label{display:none}.page-jump{grid-area:jump;display:block;width:68px;height:36px;font-size:12px}.page-status{grid-area:status;justify-self:end;align-self:center;min-width:0;font-size:12px}.page-slider{grid-area:slider;height:7px}.page-slider::-webkit-slider-thumb{width:20px;height:20px}.page-slider::-moz-range-thumb{width:18px;height:18px}.zoom-tools{display:none!important}#soundBtn{grid-area:sound;width:100%;height:40px;font-size:12px}#fullBtn{grid-area:full;width:100%;height:40px;font-size:12px}#shareBtn{grid-area:share;width:100%;height:42px;font-size:12px}.reader-shell.is-fullscreen .reader-stage{padding:6px 6px 58px}.reader-shell.is-fullscreen .control-row{padding:7px}.fullscreen-prompt{bottom:62px;font-size:10px}}
</style>
</head>
<body>
<div class="reader-shell" id="readerShell">
  <main class="reader-stage" id="readerStage">
    <button class="edge-arrow left" id="leftEdge" aria-label="Previous page">‹</button>
    <div class="zoom-space" id="zoomSpace"><div class="book-frame" id="bookFrame"><div class="flip-book" id="book">${pageMarkup}</div></div></div>
    <div class="turn-hint" id="turnHint">Drag the hard cover corner to open</div>
    <button class="edge-arrow right" id="rightEdge" aria-label="Next page">›</button>
  </main>
  <footer class="control-row">
    <div class="control-dock">
      <button class="nav-btn" id="prevBtn">← Previous</button>
      <div class="seek-wrap">
        <span class="seek-label">Page</span>
        <input id="pageSlider" class="page-slider" type="range" min="1" max="${Math.max(1, pageCount)}" value="1" step="1" aria-label="Jump to page">
        <div class="page-status" id="pageStatus">Cover</div>
        <input id="pageJump" class="page-jump" type="number" min="1" max="${Math.max(1, pageCount)}" value="1" aria-label="Go to page number">
      </div>
      <div class="zoom-tools" aria-label="Zoom controls">
        <button class="tool-btn" id="zoomOutBtn" aria-label="Zoom out">−</button>
        <button class="tool-btn zoom-value" id="zoomResetBtn" title="Reset zoom"><span id="zoomValue">100%</span></button>
        <button class="tool-btn" id="zoomInBtn" aria-label="Zoom in">+</button>
      </div>
      <button class="tool-btn sound-btn" id="soundBtn" title="Page-turn sound"><span id="soundIcon">🔊</span><span>Sound</span></button>
      <button class="tool-btn primary" id="shareBtn" title="Share">↗ Share</button>
      <button class="tool-btn" id="fullBtn" title="Fullscreen"><span id="fullIcon">⛶</span><span id="fullLabel">Fullscreen</span></button>
      <button class="nav-btn next" id="nextBtn">Open →</button>
    </div>
  </footer>
  <div class="fullscreen-prompt" id="fullscreenPrompt">Move the pointer or tap to show controls</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js"></script>
<script>
const DATA=${safeJson(payload)};
const byId=id=>document.getElementById(id);
const shell=byId('readerShell'),bookEl=byId('book'),bookFrame=byId('bookFrame'),zoomSpace=byId('zoomSpace'),readerStage=byId('readerStage');
const prevBtn=byId('prevBtn'),nextBtn=byId('nextBtn'),leftEdge=byId('leftEdge'),rightEdge=byId('rightEdge'),pageSlider=byId('pageSlider'),pageJump=byId('pageJump'),pageStatus=byId('pageStatus'),turnHint=byId('turnHint');
const zoomOutBtn=byId('zoomOutBtn'),zoomInBtn=byId('zoomInBtn'),zoomResetBtn=byId('zoomResetBtn'),zoomValue=byId('zoomValue'),soundBtn=byId('soundBtn'),soundIcon=byId('soundIcon'),fullBtn=byId('fullBtn'),fullLabel=byId('fullLabel'),fullIcon=byId('fullIcon'),fullPrompt=byId('fullscreenPrompt');
let pageFlip=null,currentIndex=0,lastIndex=0,audioCtx=null,soundEnabled=true,zoomLevel=1,fitScale=1,baseFrameWidth=0,baseFrameHeight=0,hideTimer=null,promptTimer=null,resizeTimer=null;
function isMobile(){return window.innerWidth<768}
function isFullscreen(){return Boolean(document.fullscreenElement)}
function pageDimensions(){
  const ratio=Math.max(.35,Math.min(1.8,Number(DATA.aspectRatio)||.70710678));
  const mobile=isMobile();
  const reserved=isFullscreen()?36:(mobile?184:92);
  const maxStageHeight=Math.max(280,window.innerHeight-reserved);
  if(mobile){let width=Math.min(window.innerWidth-(isFullscreen()?10:18),560),height=width/ratio;if(height>maxStageHeight){height=maxStageHeight;width=height*ratio}return{width:Math.max(180,Math.round(width)),height:Math.max(250,Math.round(height)),mobile:true}}
  let height=Math.min(maxStageHeight,980),width=height*ratio;const maxSpreadWidth=Math.max(620,window.innerWidth-(isFullscreen()?90:100));if(width*2>maxSpreadWidth){width=maxSpreadWidth/2;height=width/ratio}return{width:Math.max(280,Math.round(width)),height:Math.max(396,Math.round(height)),mobile:false};
}
function spreadState(){try{const collection=pageFlip?.getPageCollection?.();if(!collection)return null;const spreads=collection.getSpread();const spreadIndex=collection.getCurrentSpreadIndex();const spread=Array.isArray(spreads)&&spreadIndex>=0?spreads[spreadIndex]:null;return{spreads,spreadIndex,spread}}catch(_){return null}}
function updateControls(index){
  currentIndex=Math.max(0,Math.min(Math.max(0,DATA.pageCount-1),Number(index)||0));
  if(!DATA.pageCount){prevBtn.disabled=nextBtn.disabled=leftEdge.disabled=rightEdge.disabled=true;pageSlider.disabled=pageJump.disabled=true;pageStatus.textContent='0 / 0';return}
  const state=spreadState(),canPrev=state?state.spreadIndex>0:currentIndex>0,canNext=state?state.spreadIndex<state.spreads.length-1:currentIndex<DATA.pageCount-1;
  prevBtn.disabled=leftEdge.disabled=!canPrev;nextBtn.disabled=rightEdge.disabled=!canNext;nextBtn.textContent=currentIndex===0?'Open →':'Next →';pageSlider.value=pageJump.value=String(currentIndex+1);
  if(currentIndex===0){pageStatus.textContent='Cover';turnHint.textContent='Drag the hard cover corner to open'}else if(currentIndex===DATA.pageCount-1){pageStatus.textContent='Back cover';turnHint.textContent='Turn back to reopen'}else if(state&&Array.isArray(state.spread)&&state.spread.length===2){pageStatus.textContent=(state.spread[0]+1)+'–'+(state.spread[1]+1)+' / '+DATA.pageCount;turnHint.textContent='Drag a page corner or swipe to turn'}else{pageStatus.textContent=(currentIndex+1)+' / '+DATA.pageCount;turnHint.textContent='Drag a page corner or swipe to turn'}
  pageSlider.style.setProperty('--progress',DATA.pageCount>1?((currentIndex/(DATA.pageCount-1))*100)+'%':'100%');
}
function ensureAudio(){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;if(!audioCtx)audioCtx=new Ctx();if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});return audioCtx}catch(_){return null}}
function noiseBuffer(ctx,duration){const length=Math.max(1,Math.floor(ctx.sampleRate*duration)),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;return buffer}
function playPageTurnSound(direction){
  if(!soundEnabled)return;const ctx=ensureAudio();if(!ctx||ctx.state!=='running')return;
  try{
    const now=ctx.currentTime,master=ctx.createGain();master.gain.value=.9;master.connect(ctx.destination);
    const rustle=ctx.createBufferSource(),band=ctx.createBiquadFilter(),rustleGain=ctx.createGain();rustle.buffer=noiseBuffer(ctx,.5);band.type='bandpass';band.frequency.setValueAtTime(1450,now);band.frequency.exponentialRampToValueAtTime(3400,now+.31);band.Q.value=.7;rustleGain.gain.setValueAtTime(.0001,now);rustleGain.gain.exponentialRampToValueAtTime(.11,now+.035);rustleGain.gain.exponentialRampToValueAtTime(.045,now+.23);rustleGain.gain.exponentialRampToValueAtTime(.0001,now+.49);rustle.connect(band);band.connect(rustleGain);
    if(ctx.createStereoPanner){const pan=ctx.createStereoPanner();pan.pan.value=direction<0?-.18:.18;rustleGain.connect(pan);pan.connect(master)}else rustleGain.connect(master);
    const flick=ctx.createBufferSource(),high=ctx.createBiquadFilter(),flickGain=ctx.createGain();flick.buffer=noiseBuffer(ctx,.13);high.type='highpass';high.frequency.value=3600;flickGain.gain.setValueAtTime(.0001,now+.08);flickGain.gain.exponentialRampToValueAtTime(.06,now+.12);flickGain.gain.exponentialRampToValueAtTime(.0001,now+.22);flick.connect(high);high.connect(flickGain);flickGain.connect(master);
    const thump=ctx.createOscillator(),thumpGain=ctx.createGain();thump.type='sine';thump.frequency.setValueAtTime(118,now+.25);thump.frequency.exponentialRampToValueAtTime(70,now+.39);thumpGain.gain.setValueAtTime(.0001,now+.23);thumpGain.gain.exponentialRampToValueAtTime(.035,now+.285);thumpGain.gain.exponentialRampToValueAtTime(.0001,now+.43);thump.connect(thumpGain);thumpGain.connect(master);
    rustle.start(now);flick.start(now+.07);thump.start(now+.22);thump.stop(now+.44);
  }catch(_){}
}
function applyTransform(){const scale=zoomLevel*fitScale;bookFrame.style.transform='scale('+scale+')';zoomSpace.style.width=Math.ceil(baseFrameWidth*scale)+'px';zoomSpace.style.height=Math.ceil(baseFrameHeight*scale)+'px';zoomValue.textContent=Math.round(zoomLevel*100)+'%';zoomOutBtn.disabled=zoomLevel<=.75;zoomInBtn.disabled=zoomLevel>=2.25}
function applyZoom(next){zoomLevel=Math.max(.75,Math.min(2.25,Math.round(next*20)/20));applyTransform();if(zoomLevel===1){readerStage.scrollLeft=0;readerStage.scrollTop=0}}
function fitFullscreen(){if(!baseFrameWidth||!baseFrameHeight){fitScale=1;return}if(!isFullscreen()){fitScale=1;applyTransform();return}const availableWidth=Math.max(320,window.innerWidth-36),availableHeight=Math.max(260,window.innerHeight-86);fitScale=Math.min(1.22,availableWidth/baseFrameWidth,availableHeight/baseFrameHeight);fitScale=Math.max(.65,fitScale);applyTransform()}
function jumpToPage(value){if(!pageFlip||!DATA.pageCount)return;const human=Math.max(1,Math.min(DATA.pageCount,Math.round(Number(value)||1)),target=human-1;ensureAudio();try{pageFlip.flip(target,'top')}catch(_){try{pageFlip.turnToPage(target);updateControls(pageFlip.getCurrentPageIndex())}catch(__){}}}
function showFullscreenControls(){if(!isFullscreen())return;shell.classList.remove('controls-hidden');fullPrompt.classList.remove('is-visible');clearTimeout(hideTimer);clearTimeout(promptTimer);hideTimer=setTimeout(()=>{if(isFullscreen()){shell.classList.add('controls-hidden');promptTimer=setTimeout(()=>fullPrompt.classList.add('is-visible'),250)}},2600)}
function syncFullscreen(){const active=isFullscreen();shell.classList.toggle('is-fullscreen',active);shell.classList.remove('controls-hidden');fullLabel.textContent=active?'Exit':'Fullscreen';fullIcon.textContent=active?'↙':'⛶';clearTimeout(hideTimer);clearTimeout(promptTimer);fullPrompt.classList.remove('is-visible');requestAnimationFrame(()=>{fitFullscreen();if(active)showFullscreenControls()})}
function init(){
  if(!DATA.pageCount){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">This flipbook has no pages.</div>';updateControls(0);return}
  if(!window.St||!window.St.PageFlip){bookEl.style.opacity='1';bookEl.innerHTML='<div class="empty">The page-turn engine could not load. Please refresh.</div>';return}
  const dims=pageDimensions();baseFrameWidth=dims.width*(dims.mobile?1:2);baseFrameHeight=dims.height;bookFrame.style.width=baseFrameWidth+'px';bookFrame.style.height=baseFrameHeight+'px';zoomSpace.style.width=baseFrameWidth+'px';zoomSpace.style.height=baseFrameHeight+'px';
  pageFlip=new window.St.PageFlip(bookEl,{width:dims.width,height:dims.height,size:'fixed',minWidth:dims.width,maxWidth:dims.width,minHeight:dims.height,maxHeight:dims.height,drawShadow:true,flippingTime:930,usePortrait:dims.mobile,startPage:0,autoSize:false,maxShadowOpacity:.55,showCover:true,mobileScrollSupport:true,swipeDistance:30,clickEventForward:true,useMouseEvents:true,showPageCorners:true,disableFlipByClick:false});
  pageFlip.on('init',event=>{currentIndex=lastIndex=Number(event.data?.page)||0;bookEl.classList.add('is-ready');updateControls(currentIndex);applyZoom(1)});
  pageFlip.on('flip',event=>{const nextIndex=Number(event.data)||0,direction=nextIndex>=lastIndex?1:-1;lastIndex=nextIndex;currentIndex=nextIndex;updateControls(nextIndex);playPageTurnSound(direction);if(turnHint)setTimeout(()=>turnHint.style.opacity='0',1400);if(isFullscreen())showFullscreenControls()});
  pageFlip.loadFromHTML(document.querySelectorAll('#book .book-page'));
  prevBtn.onclick=()=>{ensureAudio();try{pageFlip.flipPrev('top')}catch(_){}};nextBtn.onclick=()=>{ensureAudio();try{pageFlip.flipNext('top')}catch(_){}};leftEdge.onclick=prevBtn.onclick;rightEdge.onclick=nextBtn.onclick;
  pageSlider.addEventListener('input',()=>{const human=Number(pageSlider.value)||1;pageJump.value=String(human);pageStatus.textContent=human+' / '+DATA.pageCount;pageSlider.style.setProperty('--progress',DATA.pageCount>1?(((human-1)/(DATA.pageCount-1))*100)+'%':'100%')});pageSlider.addEventListener('change',()=>jumpToPage(pageSlider.value));pageJump.addEventListener('change',()=>jumpToPage(pageJump.value));pageJump.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();jumpToPage(pageJump.value);pageJump.blur()}});
  zoomOutBtn.onclick=()=>applyZoom(zoomLevel-.25);zoomInBtn.onclick=()=>applyZoom(zoomLevel+.25);zoomResetBtn.onclick=()=>applyZoom(1);
  soundBtn.onclick=()=>{ensureAudio();soundEnabled=!soundEnabled;soundBtn.classList.toggle('is-muted',!soundEnabled);soundIcon.textContent=soundEnabled?'🔊':'🔇'};
  document.addEventListener('keydown',event=>{if(document.activeElement===pageJump||document.activeElement===pageSlider)return;if((event.ctrlKey||event.metaKey)&&event.key==='='){event.preventDefault();applyZoom(zoomLevel+.25);return}if((event.ctrlKey||event.metaKey)&&event.key==='-'){event.preventDefault();applyZoom(zoomLevel-.25);return}if((event.ctrlKey||event.metaKey)&&event.key==='0'){event.preventDefault();applyZoom(1);return}if(event.key==='ArrowRight'||event.key==='PageDown'){event.preventDefault();nextBtn.onclick()}if(event.key==='ArrowLeft'||event.key==='PageUp'){event.preventDefault();prevBtn.onclick()}if(event.key==='Home'){event.preventDefault();jumpToPage(1)}if(event.key==='End'){event.preventDefault();jumpToPage(DATA.pageCount)}});
  document.addEventListener('pointerdown',ensureAudio,{once:true});
}
window.addEventListener('load',init,{once:true});
fullBtn.onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
document.addEventListener('fullscreenchange',syncFullscreen);document.addEventListener('mousemove',()=>{if(isFullscreen())showFullscreenControls()},{passive:true});document.addEventListener('touchstart',()=>{if(isFullscreen())showFullscreenControls()},{passive:true});document.addEventListener('pointerdown',()=>{if(isFullscreen())showFullscreenControls()},{passive:true});
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(isFullscreen())fitFullscreen()},100)});
shareBtn.onclick=async()=>{const url=DATA.publicUrl;try{if(navigator.share)await navigator.share({title:DATA.title,url});else{await navigator.clipboard.writeText(url);const old=shareBtn.innerHTML;shareBtn.textContent='Copied';setTimeout(()=>shareBtn.innerHTML=old,1200)}}catch(_){}};
try{const key='lmsgen-flipbook-viewed:'+DATA.token;if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,'1');fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{})}}catch(_){}
</script>
</body>
</html>`;
}

module.exports = { renderFlipbookReader };
