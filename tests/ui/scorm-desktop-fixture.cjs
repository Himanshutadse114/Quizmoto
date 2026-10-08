const proxyquire = require('../../server/node_modules/proxyquire').noCallThru();
const JSZip = require('../../server/node_modules/jszip');
const { buildPresentationScormZip } = require('../../server/services/scorm/ScormPresentationPackageBuilder');
const { inject } = require('../../server/services/scorm/ScormMobileHardeningRuntime');

async function playerHtml(source) {
  const router = proxyquire('../../server/routes/scorm/play', {
    '../../services/scorm/ScormInviteService': { verifyRegistrationToken: () => ({ scormRegId: 'desktop-qa' }) },
    '../../models/scorm': { ScormRegistration: { findByPk: async () => ({ id: 'desktop-qa', learnerName: 'QA Learner', course: { title: 'Desktop canvas QA', package: { status: 'ready', source, entryHref: 'index.html' } } }) }, ScormCourse: {}, ScormPackage: {} }
  });
  const handler = router.stack.find(layer => layer.route?.path === '/:regId').route.stack[0].handle;
  let html = '';
  const res = { setHeader() {}, send(value) { html = value; }, status(code) { throw new Error(`Player returned ${code}`); } };
  await handler({ params: { regId: 'desktop-qa' }, query: { token: 'fixture-token' } }, res);
  return html;
}

const desktopCourse = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font:18px Arial}#app{width:100%;height:100%;display:grid;grid-template-columns:280px 1fr;background:#eef8f6}aside{background:#123c38;color:white;padding:32px}main{padding:48px}button{padding:16px 24px}#layout:after{content:'Desktop CSS'}@media(max-width:820px){#app{grid-template-columns:1fr}aside{display:none}#layout:after{content:'Responsive CSS'}}
</style></head><body><div id="app"><aside>Course navigation</aside><main><h1>Desktop course content</h1><p id="layout"></p><p id="js-layout"></p><button id="go">Next slide</button><p id="position">Slide 1</p></main></div><script>
document.getElementById('js-layout').textContent=innerWidth<820?'Responsive JavaScript':'Desktop JavaScript';
parent.API.LMSInitialize('');document.getElementById('go').onclick=()=>{document.getElementById('position').textContent='Slide 2';parent.API.LMSSetValue('cmi.core.lesson_location','1');parent.API.LMSCommit('')};
</script></body></html>`;

let presentationPromise;
function presentation() {
  if (!presentationPromise) presentationPromise = buildPresentationScormZip({ title: 'Desktop presentation', slides: [{ path: 'slides/slide-001.svg', width: 1600, height: 900, body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#164452"/><text x="80" y="150" fill="white" font-size="70">Desktop presentation</text></svg>' }], quiz: { questions: [{ questionText: 'Select the correct option', options: ['Correct', 'Incorrect', 'Another incorrect answer', 'None of these'], correctIndex: 0 }] } }).then(buffer => JSZip.loadAsync(buffer));
  return presentationPromise;
}

async function openCourse(page, source) {
  const shell = await playerHtml(source);
  const zip = source === 'presentation_import' ? await presentation() : null;
  const saves = [];
  await page.route('**/course-player', route => route.fulfill({ contentType: 'text/html', body: shell }));
  await page.route('**/api/scorm/session/**', async route => {
    if (route.request().method() === 'POST') saves.push(route.request().postDataJSON());
    await route.fulfill({ json: { values: {}, resume: false, summary: { progressPercent: 0 } } });
  });
  await page.route('**/api/scorm/content/t/**', async route => {
    const path = new URL(route.request().url()).pathname.split('/fixture-token/')[1];
    if (zip) {
      const file = zip.file(path);
      if (!file) return route.fulfill({ status: 404 });
      const contentType = path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.svg') ? 'image/svg+xml' : 'font/woff2';
      return route.fulfill({ contentType, body: await file.async('nodebuffer') });
    }
    return route.fulfill({ contentType: 'text/html', body: source === 'ai_author' ? inject(desktopCourse) : desktopCourse });
  });
  await page.goto('/course-player');
  return { frame: page.frameLocator('#frame'), saves };
}

module.exports = { playerHtml, openCourse };
