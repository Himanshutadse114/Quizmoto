const JSZip = require('jszip');
const { buildScormPackageZip: buildVisualPackage } = require('./ScormVisualThemeFinalizer');

function patchTrackingRuntime(html) {
    let out = String(html || '');

    // The legacy generated player rendered first, which triggered updateNav()
    // before LMSInitialize(). That made the first lesson_location write fail with
    // SCORM error 301. Initialize first, then render/commit the current screen.
    out = out.replace(
        "window.onload=function(){sessionStartMs=Date.now();render();if(typeof doLMSInitialize==='function'){doLMSInitialize();",
        "window.onload=function(){sessionStartMs=Date.now();lastSessionWriteMs=sessionStartMs;if(typeof doLMSInitialize==='function'){doLMSInitialize();"
    );
    out = out.replace(
        "writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}};window.addEventListener('beforeunload'",
        "writeSessionTime();doLMSCommit();commitTimer=setInterval(function(){if(!completed)commitProgress()},15000)}render();};window.addEventListener('beforeunload'"
    );

    // Persist both the zero-based screen location and a small suspend payload on
    // every navigation action. The location remains SCORM 1.2 compatible and is
    // what Quizmoto uses to derive completion percentage and the last screen.
    out = out.replace(
        "commitProgress({'cmi.core.lesson_location':String(currentSlide)})",
        "commitProgress({'cmi.core.lesson_location':String(currentSlide),'cmi.suspend_data':JSON.stringify({quizmotoSlide:currentSlide,quizmotoProgress:p})})"
    );

    // Server commit() rolls session_time into total_time and resets the session
    // accumulator. Write only the time since the previous commit to avoid
    // double-counting cumulative elapsed time on every 15-second commit.
    out = out.replace(
        'sessionStartMs=Date.now(),commitTimer=null;',
        'sessionStartMs=Date.now(),lastSessionWriteMs=sessionStartMs,commitTimer=null;'
    );
    out = out.replace(
        "function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{doLMSSetValue('cmi.core.session_time',formatSessionTime(Date.now()-sessionStartMs))}catch(e){}}",
        "function writeSessionTime(){if(typeof doLMSSetValue!=='function')return;try{var now=Date.now();doLMSSetValue('cmi.core.session_time',formatSessionTime(now-lastSessionWriteMs));lastSessionWriteMs=now}catch(e){}}"
    );

    return out;
}

async function buildScormPackageZip(rawAnalysis, opts = {}) {
    const baseBuffer = await buildVisualPackage(rawAnalysis, opts);
    const zip = await JSZip.loadAsync(baseBuffer);
    const indexFile = zip.file('index.html');
    if (!indexFile) return baseBuffer;

    const html = await indexFile.async('string');
    const patched = patchTrackingRuntime(html);
    zip.file('index.html', patched);

    const contentFile = zip.file('content.json');
    if (contentFile) {
        try {
            const content = JSON.parse(await contentFile.async('string'));
            zip.file('content.json', JSON.stringify({
                ...content,
                trackingVersion: 2,
                progressTracking: 'lesson_location'
            }, null, 2));
        } catch (_) {
            // Keep the original content.json if an older package has malformed metadata.
        }
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = {
    buildScormPackageZip,
    patchTrackingRuntime
};