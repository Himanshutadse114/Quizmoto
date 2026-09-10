const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Flipbook = require('../models/Flipbook');
const {
    ensureAnalyticsSchema,
    startReaderSession,
    recordReaderEvents,
    getBookAnalytics,
    getLibraryAnalytics
} = require('../services/FlipbookAnalyticsService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

async function publicBook(shareToken) {
    return Flipbook.findOne({
        where: { shareToken, status: 'published', shareEnabled: true }
    });
}

function forwardedIp(req) {
    const header = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return header || req.ip || req.socket?.remoteAddress || '';
}

function trackingInjection(shareToken) {
    const basePath = `/api/scorm/flipbooks/public/${encodeURIComponent(shareToken)}`;
    return {
        style: `<style id="lmsgen-flipbook-analytics-style">
#lmsgenReaderGate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(235,248,246,.96);backdrop-filter:blur(10px);font-family:Inter,Arial,sans-serif;color:#17313a}
#lmsgenReaderGate.is-hidden{display:none}.lmsgen-reader-card{width:min(440px,100%);background:#fff;border:1px solid #d7ece8;border-radius:22px;box-shadow:0 24px 70px rgba(23,49,58,.16);padding:24px}.lmsgen-reader-mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:#e8f8f7;color:#0f9a95;font-size:21px;font-weight:800}.lmsgen-reader-card h2{margin:16px 0 7px;font-size:20px;line-height:1.15}.lmsgen-reader-card p{margin:0;color:#6a8588;font-size:12px;line-height:1.6}.lmsgen-reader-field{display:block;margin-top:16px}.lmsgen-reader-field span{display:block;margin-bottom:6px;font-size:10px;font-weight:800;color:#45666a;text-transform:uppercase;letter-spacing:.06em}.lmsgen-reader-field input{width:100%;height:45px;border:1px solid #d7ece8;border-radius:11px;background:#fff;color:#17313a;padding:0 12px;font:600 13px Inter,Arial,sans-serif;outline:none}.lmsgen-reader-field input:focus{border-color:#17b6b0;box-shadow:0 0 0 3px rgba(23,182,176,.12)}#lmsgenReaderSubmit{margin-top:18px;width:100%;height:46px;border:0;border-radius:11px;background:#17b6b0;color:#fff;font:800 13px Inter,Arial,sans-serif;cursor:pointer}#lmsgenReaderSubmit:hover{background:#0f9a95}#lmsgenReaderSubmit:disabled{opacity:.55;cursor:wait}.lmsgen-reader-privacy{margin-top:12px!important;font-size:10px!important;color:#789194!important}.lmsgen-reader-error{display:none;margin-top:10px;padding:9px 10px;border-radius:9px;background:#fff1f2;color:#be123c;font-size:11px}.lmsgen-reader-error.is-visible{display:block}
</style>`,
        html: `<div id="lmsgenReaderGate"><form class="lmsgen-reader-card" id="lmsgenReaderForm"><div class="lmsgen-reader-mark">L</div><h2>Open this flipbook</h2><p>Enter your details to continue reading.</p><label class="lmsgen-reader-field"><span>Email address</span><input id="lmsgenReaderEmail" type="email" autocomplete="email" required placeholder="name@company.com"></label><label class="lmsgen-reader-field"><span>Name (optional)</span><input id="lmsgenReaderName" type="text" autocomplete="name" maxlength="160" placeholder="Your name"></label><div class="lmsgen-reader-error" id="lmsgenReaderError"></div><button id="lmsgenReaderSubmit" type="submit">Open flipbook</button><p class="lmsgen-reader-privacy">Your email and reading activity are shared with the flipbook author for engagement analytics.</p></form></div>`,
        script: `<script id="lmsgen-flipbook-analytics-script">
(()=>{
  const BASE=${JSON.stringify(basePath)};
  const SOURCE=new URLSearchParams(location.search).get('source')||'share';
  const gate=document.getElementById('lmsgenReaderGate');
  const form=document.getElementById('lmsgenReaderForm');
  const emailInput=document.getElementById('lmsgenReaderEmail');
  const nameInput=document.getElementById('lmsgenReaderName');
  const submit=document.getElementById('lmsgenReaderSubmit');
  const errorBox=document.getElementById('lmsgenReaderError');
  let sessionToken='';
  let lastIndex=0;
  let attached=false;
  let completedSent=false;
  let heartbeatTimer=null;
  let idleTimer=null;
  let sendQueue=Promise.resolve();
  let activeBaseSeconds=0;
  let activeAccumulatedMs=0;
  let activeStartedAt=0;
  let active=false;
  const seenPages=new Set([0]);
  try{emailInput.value=localStorage.getItem('lmsgen-flipbook-reader-email')||'';nameInput.value=localStorage.getItem('lmsgen-flipbook-reader-name')||''}catch(_){}

  function activeSeconds(){
    let total=activeAccumulatedMs;
    if(active&&activeStartedAt)total+=performance.now()-activeStartedAt;
    return activeBaseSeconds+Math.max(0,Math.floor(total/1000));
  }
  function pauseActive(){
    if(!active)return;
    activeAccumulatedMs+=Math.max(0,performance.now()-activeStartedAt);
    active=false;activeStartedAt=0;
  }
  function scheduleIdle(){
    if(idleTimer)clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>pauseActive(),60000);
  }
  function markActivity(){
    if(!sessionToken||document.visibilityState!=='visible')return;
    if(!active){active=true;activeStartedAt=performance.now()}
    scheduleIdle();
  }
  function send(events,keepalive=false){
    if(!sessionToken||!events?.length)return Promise.resolve();
    const request=()=>fetch(BASE+'/session/'+encodeURIComponent(sessionToken)+'/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events}),keepalive}).catch(()=>{});
    if(keepalive)return request();
    sendQueue=sendQueue.then(request,request);
    return sendQueue;
  }
  function visiblePages(){
    try{
      const collection=pageFlip?.getPageCollection?.();
      const spreads=collection?.getSpread?.();
      const spreadIndex=Number(collection?.getCurrentSpreadIndex?.());
      const spread=Array.isArray(spreads)&&Number.isInteger(spreadIndex)?spreads[spreadIndex]:null;
      if(Array.isArray(spread)&&spread.length){
        return [...new Set(spread.map(Number).filter(Number.isFinite).map(v=>Math.max(0,Math.floor(v))))];
      }
    }catch(_){}
    try{return [Math.max(0,Number(pageFlip?.getCurrentPageIndex?.())||0)]}catch(_){return [Math.max(0,lastIndex||0)]}
  }
  function visiblePageEvents(){
    const events=[];
    const pages=visiblePages();
    pages.forEach(pageIndex=>{
      if(seenPages.has(pageIndex))return;
      seenPages.add(pageIndex);
      events.push({eventType:'page_view',pageIndex,elapsedSeconds:activeSeconds()});
    });
    const lastPage=(typeof DATA!=='undefined'&&DATA.pageCount)?DATA.pageCount-1:null;
    if(lastPage!==null&&pages.includes(lastPage)&&!completedSent){
      completedSent=true;
      events.push({eventType:'complete',pageIndex:lastPage,elapsedSeconds:activeSeconds()});
    }
    return events;
  }
  function trackFlip(index){
    markActivity();
    const next=Math.max(0,Number(index)||0);
    requestAnimationFrame(()=>{
      const events=[];
      if(next!==lastIndex){
        const direction=next>lastIndex?'forward':'backward';
        lastIndex=next;
        events.push({eventType:'flip',pageIndex:next,direction,elapsedSeconds:activeSeconds()});
      }
      events.push(...visiblePageEvents());
      send(events);
    });
  }
  function attachFlipTracking(){
    if(attached)return true;
    try{
      if(typeof pageFlip==='undefined'||!pageFlip)return false;
      attached=true;
      try{lastIndex=Number(pageFlip.getCurrentPageIndex?.()||0)}catch(_){}
      visiblePages().forEach(page=>seenPages.add(page));
      pageFlip.on('flip',event=>trackFlip(Number(event.data)||0));
      pageFlip.on('changeOrientation',()=>requestAnimationFrame(()=>send(visiblePageEvents())));
      const share=document.getElementById('shareBtn');
      if(share)share.addEventListener('click',()=>{markActivity();send([{eventType:'share',pageIndex:lastIndex,elapsedSeconds:activeSeconds()}])});
      return true;
    }catch(_){return false}
  }
  function startHeartbeat(){
    if(heartbeatTimer)clearInterval(heartbeatTimer);
    heartbeatTimer=setInterval(()=>{
      if(!sessionToken)return;
      send([{eventType:'heartbeat',pageIndex:lastIndex,elapsedSeconds:activeSeconds()}]);
    },15000);
  }
  function attachActivityListeners(){
    ['pointerdown','keydown','wheel','touchstart'].forEach(type=>document.addEventListener(type,markActivity,{passive:true}));
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='hidden'){
        pauseActive();
        send([{eventType:'heartbeat',pageIndex:lastIndex,elapsedSeconds:activeSeconds()}],true);
      }else markActivity();
    });
  }

  form?.addEventListener('submit',async event=>{
    event.preventDefault();
    errorBox.classList.remove('is-visible');
    const email=String(emailInput.value||'').trim().toLowerCase();
    const name=String(nameInput.value||'').trim();
    if(!/^\\S+@\\S+\\.\\S+$/.test(email)){errorBox.textContent='Enter a valid email address.';errorBox.classList.add('is-visible');return}
    submit.disabled=true;submit.textContent='Opening…';
    try{
      const response=await fetch(BASE+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,name,source:SOURCE,referrer:document.referrer||''})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||'Could not start the reader session.');
      sessionToken=data.sessionToken;
      activeBaseSeconds=Math.max(0,Number(data.durationSeconds)||0);
      try{localStorage.setItem('lmsgen-flipbook-reader-email',email);if(name)localStorage.setItem('lmsgen-flipbook-reader-name',name)}catch(_){}
      gate.classList.add('is-hidden');
      markActivity();
      attachActivityListeners();
      window.setTimeout(()=>{if(!attachFlipTracking()){const timer=setInterval(()=>{if(attachFlipTracking())clearInterval(timer)},150)}},0);
      startHeartbeat();
    }catch(err){errorBox.textContent=err.message||'Could not open this flipbook.';errorBox.classList.add('is-visible');submit.disabled=false;submit.textContent='Open flipbook'}
  });
  window.addEventListener('pagehide',()=>{
    pauseActive();
    if(sessionToken)send([{eventType:'heartbeat',pageIndex:lastIndex,elapsedSeconds:activeSeconds()}],true);
  });
})();
</script>`
    };
}

router.use('/public/:shareToken/view', (req, res, next) => {
    if (req.method !== 'GET') return next();
    const originalSend = res.send.bind(res);
    res.send = function sendTrackedReader(body) {
        try {
            const source = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
            if (source.includes('id="readerStage"') && !source.includes('lmsgenReaderGate')) {
                const injected = trackingInjection(req.params.shareToken);
                body = source
                    .replace('</head>', `${injected.style}</head>`)
                    .replace('</body>', `${injected.html}${injected.script}</body>`);
                res.removeHeader('Content-Length');
            }
        } catch (err) {
            console.warn('[flipbook-analytics] reader injection skipped', err?.message || err);
        }
        return originalSend(body);
    };
    next();
});

router.post('/public/:shareToken/view', async (req, res) => {
    res.json({ ok: true, legacy: true });
});

router.post('/public/:shareToken/session', async (req, res, next) => {
    try {
        await ensureAnalyticsSchema();
        const book = await publicBook(req.params.shareToken);
        if (!book) return res.status(404).json({ message: 'This flipbook is not available.' });
        const session = await startReaderSession({
            book,
            email: req.body?.email,
            name: req.body?.name,
            source: req.body?.source || 'share',
            userAgent: req.headers['user-agent'] || '',
            referrer: req.body?.referrer || req.headers.referer || '',
            ipAddress: forwardedIp(req)
        });
        res.status(201).json(session);
    } catch (err) {
        next(err);
    }
});

router.post('/public/:shareToken/session/:sessionToken/events', async (req, res, next) => {
    try {
        const book = await publicBook(req.params.shareToken);
        if (!book) return res.status(404).json({ message: 'This flipbook is not available.' });
        const result = await recordReaderEvents({
            book,
            sessionToken: req.params.sessionToken,
            events: req.body?.events || []
        });
        res.json(result);
    } catch (err) {
        next(err);
    }
});

async function genericPlatformAuth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
        req.flipbookAnalyticsUser = user;
        next();
    } catch (_) {
        return res.status(401).json({ message: 'Token is not valid' });
    }
}

router.get('/analytics/library', genericPlatformAuth, async (req, res, next) => {
    try {
        const analytics = await getLibraryAnalytics({
            ownerUserId: req.flipbookAnalyticsUser.id,
            days: req.query.days
        });
        res.json({ analytics });
    } catch (err) {
        next(err);
    }
});

router.get('/:id/analytics', genericPlatformAuth, async (req, res, next) => {
    try {
        const book = await Flipbook.findOne({ where: { id: req.params.id, ownerUserId: req.flipbookAnalyticsUser.id } });
        if (!book) return res.status(404).json({ message: 'Flipbook not found.' });
        const analytics = await getBookAnalytics({ book, days: req.query.days });
        res.json({ analytics });
    } catch (err) {
        next(err);
    }
});

router.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[flipbook-analytics]', err);
    res.status(err.status || 500).json({
        message: err.message || 'Flipbook analytics request failed.',
        code: err.code || 'FLIPBOOK_ANALYTICS_ERROR'
    });
});

module.exports = router;
