const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Flipbook = require('../models/Flipbook');
const FlipbookLibrary = require('../models/FlipbookLibrary');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const PUBLIC_APP_URL = String(
    process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || 'https://www.lmsgen.in'
).replace(/\/+$/, '');
let schemaPromise = null;

async function ensureLibrarySchema() {
    if (!schemaPromise) {
        schemaPromise = FlipbookLibrary.sync().catch((err) => {
            schemaPromise = null;
            throw err;
        });
    }
    await schemaPromise;
}

function shareToken() {
    return crypto.randomBytes(24).toString('hex');
}

function cleanText(value, maxLength) {
    const text = String(value || '').trim();
    return text ? text.slice(0, maxLength) : '';
}

function libraryUrl(library) {
    return `${PUBLIC_APP_URL}/flipbook-library/${library.shareToken}`;
}

function bookShareUrl(book, source = '') {
    const base = `${PUBLIC_APP_URL}/flipbook/${book.shareToken}`;
    return source ? `${base}?source=${encodeURIComponent(source)}` : base;
}

async function getOrCreateLibrary(user) {
    await ensureLibrarySchema();
    const [library] = await FlipbookLibrary.findOrCreate({
        where: { ownerUserId: user.id },
        defaults: {
            ownerUserId: user.id,
            ownerEmail: String(user.email || '').trim().toLowerCase() || null,
            title: `${user.username || 'My'} Flipbook Library`.slice(0, 180),
            description: null,
            shareToken: shareToken(),
            shareEnabled: true
        }
    });
    const email = String(user.email || '').trim().toLowerCase() || null;
    if (library.ownerEmail !== email) {
        library.ownerEmail = email;
        await library.save();
    }
    return library;
}

async function publishedBooks(ownerUserId) {
    return Flipbook.findAll({
        where: { ownerUserId, status: 'published', shareEnabled: true },
        order: [['publishedAt', 'DESC'], ['updatedAt', 'DESC']]
    });
}

function libraryPayload(library, books = []) {
    return {
        id: library.id,
        title: library.title,
        description: library.description || '',
        shareEnabled: Boolean(library.shareEnabled),
        shareToken: library.shareToken,
        shareUrl: library.shareEnabled ? libraryUrl(library) : null,
        bookCount: books.length,
        updatedAt: library.updatedAt,
        books: books.map((book) => ({
            id: book.id,
            title: book.title,
            description: book.description || '',
            pageCount: Number(book.pageCount || 0),
            viewCount: Number(book.viewCount || 0),
            publishedAt: book.publishedAt || null,
            shareUrl: bookShareUrl(book, 'library'),
            coverPath: Number(book.pageCount || 0) ? `/api/scorm/flipbooks/public/${book.shareToken}/pages/0` : null
        }))
    };
}

async function genericPlatformAuth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findByPk(decoded.userId);
        if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
        req.flipbookLibraryUser = user;
        next();
    } catch (_) {
        return res.status(401).json({ message: 'Token is not valid' });
    }
}

function spreadTrackingPatch(shareTokenValue) {
    const basePath = `/api/scorm/flipbooks/public/${encodeURIComponent(shareTokenValue)}`;
    return `<script id="lmsgen-flipbook-spread-tracking-patch">
(()=>{
  if(window.__lmsgenSpreadTrackingPatch)return;
  window.__lmsgenSpreadTrackingPatch=true;
  const BASE=${JSON.stringify(basePath)};
  const nativeFetch=window.fetch.bind(window);
  let readerSessionToken='';
  let attached=false;
  let retryTimer=null;

  function visiblePages(){
    try{
      if(typeof pageFlip==='undefined'||!pageFlip)return [];
      const collection=pageFlip.getPageCollection?.();
      const spreads=collection?.getSpread?.();
      const spreadIndex=collection?.getCurrentSpreadIndex?.();
      const spread=Array.isArray(spreads)&&Number.isInteger(spreadIndex)&&spreadIndex>=0?spreads[spreadIndex]:null;
      if(Array.isArray(spread)&&spread.length){
        return [...new Set(spread.map(Number).filter(Number.isFinite).map(value=>Math.max(0,Math.floor(value))))];
      }
      const current=Number(pageFlip.getCurrentPageIndex?.());
      return Number.isFinite(current)?[Math.max(0,Math.floor(current))]:[];
    }catch(_){return []}
  }

  function sendVisiblePages(){
    if(!readerSessionToken)return;
    const pages=visiblePages();
    if(!pages.length)return;
    nativeFetch(BASE+'/session/'+encodeURIComponent(readerSessionToken)+'/events',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({events:pages.map(pageIndex=>({eventType:'page_view',pageIndex}))}),
      keepalive:true
    }).catch(()=>{});
  }

  function attach(){
    if(attached)return true;
    try{
      if(typeof pageFlip==='undefined'||!pageFlip)return false;
      attached=true;
      pageFlip.on('flip',()=>window.setTimeout(sendVisiblePages,60));
      window.setTimeout(sendVisiblePages,80);
      return true;
    }catch(_){return false}
  }

  function begin(){
    if(attach())return;
    if(retryTimer)clearInterval(retryTimer);
    retryTimer=setInterval(()=>{if(attach()){clearInterval(retryTimer);retryTimer=null}},150);
    setTimeout(()=>{if(retryTimer){clearInterval(retryTimer);retryTimer=null}},6000);
  }

  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    try{
      const requestUrl=typeof input==='string'?input:String(input?.url||'');
      const method=String(init?.method||input?.method||'GET').toUpperCase();
      if(method==='POST'&&requestUrl.includes(BASE+'/session')&&!requestUrl.includes('/events')){
        const data=await response.clone().json().catch(()=>null);
        if(data?.sessionToken){readerSessionToken=String(data.sessionToken);window.setTimeout(begin,0)}
      }
    }catch(_){}
    return response;
  };
})();
</script>`;
}

// StPageFlip reports one anchor page when a desktop spread changes. Inject a
// lightweight patch before the analytics layer so both visible pages in each
// desktop spread are recorded as page views.
router.use('/public/:shareToken/view', (req, res, next) => {
    if (req.method !== 'GET') return next();
    const originalSend = res.send.bind(res);
    res.send = function sendSpreadTrackingPatchedReader(body) {
        try {
            const source = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
            if (source.includes('id="readerStage"') && !source.includes('lmsgen-flipbook-spread-tracking-patch')) {
                body = source.replace('</body>', `${spreadTrackingPatch(req.params.shareToken)}</body>`);
                res.removeHeader('Content-Length');
            }
        } catch (err) {
            console.warn('[flipbook-library] spread tracking patch skipped', err?.message || err);
        }
        return originalSend(body);
    };
    next();
});

router.get('/public-library/:shareToken', async (req, res, next) => {
    try {
        await ensureLibrarySchema();
        const library = await FlipbookLibrary.findOne({ where: { shareToken: req.params.shareToken, shareEnabled: true } });
        if (!library) return res.status(404).json({ message: 'This flipbook library is not available.' });
        const books = await publishedBooks(library.ownerUserId);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ library: libraryPayload(library, books) });
    } catch (err) {
        next(err);
    }
});

router.get('/library', genericPlatformAuth, async (req, res, next) => {
    try {
        const library = await getOrCreateLibrary(req.flipbookLibraryUser);
        const books = await publishedBooks(req.flipbookLibraryUser.id);
        res.json({ library: libraryPayload(library, books) });
    } catch (err) {
        next(err);
    }
});

router.patch('/library', genericPlatformAuth, async (req, res, next) => {
    try {
        const library = await getOrCreateLibrary(req.flipbookLibraryUser);
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'title')) {
            library.title = cleanText(req.body.title, 180) || 'Flipbook Library';
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            library.description = cleanText(req.body.description, 2000) || null;
        }
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'shareEnabled')) {
            library.shareEnabled = Boolean(req.body.shareEnabled);
        }
        await library.save();
        const books = await publishedBooks(req.flipbookLibraryUser.id);
        res.json({ library: libraryPayload(library, books) });
    } catch (err) {
        next(err);
    }
});

router.post('/library/regenerate-share-link', genericPlatformAuth, async (req, res, next) => {
    try {
        const library = await getOrCreateLibrary(req.flipbookLibraryUser);
        library.shareToken = shareToken();
        await library.save();
        const books = await publishedBooks(req.flipbookLibraryUser.id);
        res.json({ library: libraryPayload(library, books) });
    } catch (err) {
        next(err);
    }
});

router.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    console.error('[flipbook-library]', err);
    res.status(err.status || 500).json({
        message: err.message || 'Flipbook library request failed.',
        code: err.code || 'FLIPBOOK_LIBRARY_ERROR'
    });
});

module.exports = router;
