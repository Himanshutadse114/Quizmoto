// The publication stays unfiltered; only the reader chrome uses the dark palette.
module.exports = `
:root{color-scheme:dark;--canvas:#080F18;--surface:#14202E;--line:#3A4D61;--ink:#F5F8FC;--muted:#B7C6D6;--accent:#53D6CA;--accent-dark:#73E5DA;--accent-soft:#203D40;--teal:#53D6CA}
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;background:var(--canvas);color:var(--ink);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
body{overflow:hidden}
.reader-shell{width:100%;max-width:100%;min-width:0;height:100dvh;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;overflow:hidden;background:var(--canvas)}
.reader-stage{position:relative;min-width:0;min-height:0;display:flex;align-items:safe center;justify-content:safe center;overflow:hidden;padding:12px 60px 8px}
.reader-stage.is-zoomed{overflow:auto}
.zoom-space{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.book-frame{display:flex;align-items:center;justify-content:center;overflow:visible;transform-origin:center center;transition:transform .18s ease}
.flip-book{opacity:0;transition:opacity .18s ease;filter:drop-shadow(0 16px 28px rgba(0,0,0,.5))}
.flip-book.is-ready{opacity:1}
.book-page{background:#fff;overflow:hidden}
.book-page img{display:block;width:100%;height:100%;object-fit:contain;background:#fff;pointer-events:none;-webkit-user-drag:none}
.front-cover-page,.back-cover-page{box-shadow:inset 0 0 24px rgba(23,49,58,.08)}
.turn-hint{position:absolute;left:50%;bottom:4px;transform:translateX(-50%);padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--muted);font-size:12px;white-space:nowrap;pointer-events:none;transition:opacity .3s ease;z-index:10}
.protection-toast{position:fixed;top:14px;left:50%;z-index:120;transform:translate(-50%,-16px);opacity:0;pointer-events:none;width:max-content;max-width:calc(100% - 32px);text-align:center;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font-size:13px;font-weight:600;transition:.18s ease}
.protection-toast.is-visible{opacity:1;transform:translate(-50%,0)}
.edge-arrow{position:fixed;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--ink);display:grid;place-items:center;font-size:25px;cursor:pointer;z-index:12}
.edge-arrow.left{left:12px}.edge-arrow.right{right:12px}
.edge-arrow:hover{background:var(--accent-soft);border-color:var(--accent)}
.edge-arrow:disabled{color:#7B8EA3;background:#101A26;cursor:not-allowed}
.empty{padding:36px;text-align:center;color:var(--muted);font-size:14px}
.control-row{display:flex;align-items:center;justify-content:center;padding:8px 12px max(10px,env(safe-area-inset-bottom));background:var(--canvas)}
.control-dock{width:min(1080px,100%);display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 8px 24px rgba(0,0,0,.25)}
.nav-btn,.tool-btn{appearance:none;border:1px solid var(--line);background:#192939;color:var(--ink);border-radius:8px;height:44px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font:600 13px/1.3 Inter,ui-sans-serif,system-ui,Arial,sans-serif;cursor:pointer;white-space:nowrap;transition:background .18s ease,border-color .18s ease}
.nav-btn:hover,.tool-btn:hover{border-color:var(--accent);background:var(--accent-soft)}
.nav-btn:disabled,.tool-btn:disabled{background:#1B2836;border-color:#334456;color:#8FA1B4;cursor:not-allowed}
.nav-btn{min-width:94px}
.nav-btn.next{background:var(--accent);border-color:var(--accent);color:#072321}
.nav-btn.next:hover:not(:disabled){background:var(--accent-dark)}
.nav-btn.next:disabled{background:#1B2836;border-color:#334456;color:#8FA1B4}
.seek-wrap{display:flex;align-items:center;gap:8px;flex:1;min-width:120px}
.seek-label{font-size:12px;color:var(--muted);white-space:nowrap}
.page-slider{appearance:none;width:100%;min-width:30px;height:24px;margin:0;background:transparent;cursor:pointer;--progress:0%}
.page-slider::-webkit-slider-runnable-track{height:5px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--progress),#506277 var(--progress) 100%)}
.page-slider::-moz-range-track{height:5px;border-radius:999px;background:linear-gradient(to right,var(--accent) 0 var(--progress),#506277 var(--progress) 100%)}
.page-slider::-webkit-slider-thumb{appearance:none;width:20px;height:20px;margin-top:-7.5px;border-radius:50%;background:var(--ink);border:2px solid var(--accent)}
.page-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:var(--ink);border:2px solid var(--accent)}
.page-status{min-width:72px;text-align:center;color:var(--muted);font-size:12px;font-weight:600;white-space:nowrap}
.page-jump{width:48px;height:44px;border:1px solid var(--line);border-radius:8px;background:#0D1825;color:var(--ink);text-align:center;font:600 14px/1.3 Inter,system-ui,Arial,sans-serif}
.tool-group{display:flex;align-items:center;gap:4px}.tool-btn{min-width:44px;padding:0 10px}
#shareBtn{border-color:transparent;background:transparent;color:var(--muted)}
#shareBtn:hover{background:var(--accent-soft);color:var(--ink)}
#shareBtn .label,#fullBtn .label{display:inline}
.zoom-value{min-width:52px;font-size:12px;color:var(--muted)}
.mobile-label{display:none}
.mobile-fullscreen-exit{display:none;position:fixed;top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));z-index:80;width:44px;height:44px;border:1px solid var(--line);border-radius:50%;background:var(--surface);color:var(--ink);font:500 24px/1 Arial,sans-serif;place-items:center}
button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:1100px){.seek-label{display:none}.control-dock{gap:6px}.nav-btn{min-width:80px;padding:0 10px}.page-jump{display:none}.tool-btn .label{display:none}}
@media(max-width:760px){
 .reader-stage{padding:8px 8px 4px}.edge-arrow{display:none}.turn-hint{bottom:3px;font-size:11px}
 .control-row{padding:6px 8px max(8px,env(safe-area-inset-bottom))}
 .control-dock{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-template-areas:"prev next share full" "seek seek seek seek";gap:6px;padding:8px;border-radius:12px}
 #prevBtn{grid-area:prev}#nextBtn{grid-area:next}#shareBtn{grid-area:share}#fullBtn{grid-area:full}
 .nav-btn,.tool-btn{min-width:0;width:100%;height:44px;padding:0 5px;font-size:13px;border-radius:8px;white-space:normal}
 .tool-btn .label{display:inline}.tool-group{display:none!important}
 .seek-wrap{grid-area:seek;display:flex;gap:8px;min-width:0;min-height:44px}
 .page-jump{display:block;width:44px;flex:0 0 44px;font-size:16px}
 .page-status{min-width:72px;font-size:12px}.page-slider{flex:1;height:44px}
}
@media(min-width:761px) and (max-width:1180px) and (hover:none) and (pointer:coarse){.reader-stage{padding:8px 52px 5px}.control-dock{width:100%;max-width:1080px}.tool-btn .label{display:none}}
@media(max-width:760px),(max-width:1180px) and (hover:none) and (pointer:coarse){
 html.reader-fullscreen,html.reader-fullscreen body{background:#050807!important}
 html.reader-fullscreen .reader-shell{height:100dvh;grid-template-rows:minmax(0,1fr);background:#050807!important}
 html.reader-fullscreen .reader-stage{padding:0!important;overflow:hidden;background:#050807!important}
 html.reader-fullscreen .control-row,html.reader-fullscreen .edge-arrow,html.reader-fullscreen .turn-hint{display:none!important}
 html.reader-fullscreen .mobile-fullscreen-exit{display:grid}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
@media print{body>*{display:none!important}body:before{content:'This protected LMSGEN Publica publication cannot be printed.';display:block!important;padding:48px;font:600 18px Inter,Arial,sans-serif;color:#17313a}}
`;
