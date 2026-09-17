const { expect } = require('chai');
const flipbookAnalyticsRouter = require('../routes/flipbookAnalytics');
const { renderFlipbookReader } = require('../views/flipbookReader');

describe('Flipbook reader experience', () => {
    it('silently restores a remembered reader identity without breaking the injected script', () => {
        const injected = flipbookAnalyticsRouter.trackingInjection('shared-book-token');
        const browserScript = injected.script
            .replace(/^<script[^>]*>/, '')
            .replace(/<\/script>$/, '');

        expect(injected.html).to.include('id="lmsgenReaderGate" class="is-restoring"');
        expect(injected.html).to.include('This browser will remember your access.');
        expect(injected.script).to.include("const PROFILE_KEY='lmsgen-flipbook-reader-profile'");
        expect(injected.script).to.include('function storedProfile()');
        expect(injected.script).to.include('async function restoreReader()');
        expect(injected.script).to.include("const email=String(saved?.email||emailInput.value||'').trim().toLowerCase()");
        expect(injected.script).to.include('/^\\S+@\\S+\\.\\S+$/');
        expect(injected.script).not.to.include('/^S+@S+.S+$/');
        expect(injected.script).to.include('try{await startSession(email,name);return}catch(_){}');
        expect(injected.script).to.include("document.visibilityState!=='visible'");
        expect(injected.script).to.include('document.hasFocus&&!document.hasFocus()');
        expect(injected.script).to.include('send(visiblePageEvents());');
        expect(injected.html).to.include('Open this publication');
        expect(injected.script).to.include('restoreReader();');
        expect(() => new Function(browserScript)).not.to.throw();
    });

    it('turns mobile fullscreen into a clean, full-viewport reading canvas', () => {
        const html = renderFlipbookReader({
            title: 'Mobile reader QA',
            shareToken: 'mobile-reader-token',
            pageCount: 2,
            pages: [{ width: 1200, height: 1600 }, { width: 1200, height: 1600 }]
        });

        expect(html).to.include('html.reader-fullscreen .reader-shell');
        expect(html).to.include('html.reader-fullscreen .control-row');
        expect(html).to.include('display:none!important');
        expect(html).to.include('id="mobileFullscreenExit"');
        expect(html).to.include('pseudoFullscreen=true');
        expect(html).to.include("document.addEventListener('fullscreenchange',syncFullscreen)");
        expect(html).to.include("document.addEventListener('webkitfullscreenchange',syncFullscreen)");
        expect(html).to.include("const fit=Math.min(window.innerWidth/baseFrameWidth,window.innerHeight/baseFrameHeight)");

        const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
        expect(inlineScript).to.be.a('string');
        expect(() => new Function(inlineScript)).not.to.throw();
    });

    it('uses a tablet-specific portrait, landscape and fullscreen experience', () => {
        const html = renderFlipbookReader({
            title: 'Tablet reader QA',
            shareToken: 'tablet-reader-token',
            pageCount: 4,
            pages: Array.from({ length: 4 }, () => ({ width: 1200, height: 1600 }))
        });

        expect(html).to.include('function isTouchTablet()');
        expect(html).to.include("touch&&window.innerWidth>=768&&window.innerWidth<=1180");
        expect(html).to.include('function useSinglePage(){return isMobile()||(isTouchTablet()&&window.innerHeight>=window.innerWidth)}');
        expect(html).to.include('isTouchTablet()?720:520');
        expect(html).to.include('@media(min-width:761px) and (max-width:1180px) and (hover:none) and (pointer:coarse)');
        expect(html).to.include("const PAGE_STATE_KEY='lmsgen-publica-page:'+DATA.token");
        expect(html).to.include('useSinglePage()===lastSinglePageMode');
        expect(html).to.include('location.reload();');

        const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
        expect(() => new Function(inlineScript)).not.to.throw();
    });
});
