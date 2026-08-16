const JSZip = require('jszip');
const { buildScormPackageZip: buildGammaPackage } = require('./ScormGammaEditorialFinalizer');

const GAMMA_LAYOUT_V2_CSS = `
<style id="scorm-ai-gamma-layout-v2">
/*
 * Layout correction layer for the single Gamma Editorial learner template.
 * Smart SVG artwork is an illustration, not a crop-to-fill photograph: preserve the full scene.
 */
.qmx-frame{
  grid-template-columns:minmax(0,1.48fr) minmax(360px,1fr)!important;
  gap:22px 38px!important;
}
.qmx-copy{
  padding:30px 10px 18px 4px!important;
}
.qmx-copy h2{
  max-width:20ch!important;
  font-size:clamp(32px,3.65vw,50px)!important;
  line-height:1.02!important;
  letter-spacing:-.032em!important;
  overflow-wrap:normal!important;
  word-break:normal!important;
  hyphens:none!important;
  text-wrap:balance!important;
}
.qmx-copy p{max-width:54ch!important}

.qmx-visual{
  min-height:0!important;
  height:auto!important;
  aspect-ratio:8 / 5!important;
  align-self:center!important;
  padding:22px!important;
  overflow:hidden!important;
  background:var(--gamma-paper-2)!important;
  border:1px solid var(--gamma-paper-3)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}
.qmx-visual picture{
  display:flex!important;
  width:100%!important;
  height:100%!important;
  align-items:center!important;
  justify-content:center!important;
}
.qmx-visual img{
  display:block!important;
  width:100%!important;
  height:100%!important;
  max-width:100%!important;
  max-height:100%!important;
  object-fit:contain!important;
  object-position:center center!important;
  margin:auto!important;
  border-radius:0!important;
  filter:none!important;
}
.qmx-visual-label{
  left:32px!important;
  bottom:32px!important;
}

/* Large visual-first learning moments retain the entire Smart SVG scene too. */
.qmx-type-scenario .qmx-frame,
.qmx-type-comparison .qmx-frame{
  grid-template-columns:minmax(310px,.82fr) minmax(500px,1.35fr)!important;
}
.qmx-type-scenario .qmx-visual,
.qmx-type-comparison .qmx-visual,
.qmx-type-hotspot .qmx-visual,
.qmx-type-reveal .qmx-visual{
  min-height:0!important;
  height:auto!important;
  aspect-ratio:8 / 5!important;
}
.qmx-type-takeaway .qmx-copy h2{max-width:20ch!important}

/* Short laptop viewports: reduce type and safe-area padding instead of cropping artwork. */
@media(max-height:760px) and (min-width:901px){
  .qmx-frame{min-height:min(500px,calc(100dvh - 154px))!important}
  .qmx-copy h2{font-size:clamp(30px,3.15vw,43px)!important;max-width:21ch!important}
  .qmx-visual{padding:16px!important;min-height:0!important;height:auto!important}
  .qmx-visual-label{left:26px!important;bottom:26px!important}
}

/* Tablet/mobile use the portrait Smart SVG without forcing it into a fixed crop box. */
@media(max-width:900px){
  .qmx-copy h2{
    max-width:22ch!important;
    font-size:clamp(29px,6.6vw,40px)!important;
  }
  .qmx-visual,
  .qmx-type-scenario .qmx-visual,
  .qmx-type-comparison .qmx-visual,
  .qmx-type-hotspot .qmx-visual,
  .qmx-type-reveal .qmx-visual{
    width:100%!important;
    min-height:0!important;
    height:auto!important;
    aspect-ratio:3 / 4!important;
    padding:16px!important;
  }
  .qmx-visual-label{left:25px!important;bottom:25px!important}
}
@media(max-width:560px){
  .qmx-copy h2{font-size:clamp(27px,7.8vw,35px)!important;max-width:22ch!important}
  .qmx-visual{padding:10px!important}
  .qmx-visual-label{left:18px!important;bottom:18px!important}
}
</style>`;

function injectGammaLayoutV2(html) {
  const source = String(html || '');
  if (source.includes('scorm-ai-gamma-layout-v2')) return source;
  return source.includes('</head>')
    ? source.replace('</head>', `${GAMMA_LAYOUT_V2_CSS}\n</head>`)
    : `${GAMMA_LAYOUT_V2_CSS}\n${source}`;
}

async function buildScormPackageZip(analysis, opts = {}) {
  const baseBuffer = await buildGammaPackage(analysis, opts);
  const zip = await JSZip.loadAsync(baseBuffer);
  const indexFile = zip.file('index.html');
  if (!indexFile) return baseBuffer;
  const html = await indexFile.async('string');
  zip.file('index.html', injectGammaLayoutV2(html));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

module.exports = {
  buildScormPackageZip,
  injectGammaLayoutV2,
  GAMMA_LAYOUT_V2_CSS
};
