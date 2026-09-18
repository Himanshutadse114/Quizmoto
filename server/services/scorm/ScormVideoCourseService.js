const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const { ScormPackage } = require('../../models/scorm');
const { getObjectStorage } = require('../../storage/ObjectStorage');
const {
    packageZipKey,
    packageContentKey,
    packageContentPrefix,
    packageMetaKey
} = require('./storageKeys');
const { ensureCourseForPackage } = require('./ScormCourseWorkspaceService');
const { deletePackageFromStorage } = require('./ScormPackageCleanup');

const VIDEO_TYPES = Object.freeze({
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov'
});

function xml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function acceptedVideoType(value) {
    const mimeType = String(value || '').split(';')[0].trim().toLowerCase();
    return VIDEO_TYPES[mimeType] ? mimeType : null;
}

function videoExtension(mimeType) {
    return VIDEO_TYPES[mimeType] || 'mp4';
}

const SCORM_WRAPPER = `var findAPITries=0;
function findAPI(win){while((win.API==null)&&(win.parent!=null)&&(win.parent!=win)){findAPITries++;if(findAPITries>500)return null;win=win.parent;}return win.API;}
function getAPI(){var a=findAPI(window);if((a==null)&&(window.opener!=null)){try{a=findAPI(window.opener);}catch(e){}}return a;}
var API=getAPI();
function doLMSInitialize(){if(!API)return "false";return API.LMSInitialize("");}
function doLMSFinish(){if(!API)return "false";return API.LMSFinish("");}
function doLMSGetValue(n){if(!API)return "";return API.LMSGetValue(n);}
function doLMSSetValue(n,v){if(!API)return "false";return API.LMSSetValue(n,String(v));}
function doLMSCommit(){if(!API)return "false";return API.LMSCommit("");}
`;

function playerHtml({ title, description, mediaPath, mimeType, durationSeconds = null }) {
    const boot = JSON.stringify({
        title: String(title || 'Video course'),
        description: String(description || ''),
        mediaPath,
        mimeType,
        durationSeconds: Number(durationSeconds) || null
    }).replace(/</g, '\\u003c');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="generator" content="LMSGEN Video Course" />
<title>${xml(title)}</title>
<script src="scorm_api_wrapper.js"></script>
<style>
:root{--teal:#21b8ae;--teal-dark:#087c74;--ink:#0c2e2b;--muted:#59716e;--line:#d8e8e5;--soft:#eff9f7;--paper:#fff}
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:#eaf5f3;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden}
button{font:inherit}.shell{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:linear-gradient(150deg,#f9fdfc 0%,#e7f4f1 100%)}
header{min-height:72px;padding:14px clamp(16px,3vw,40px);display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--line);background:#ffffffed;backdrop-filter:blur(12px)}
.brand{display:flex;align-items:center;gap:10px;flex:0 0 auto}.mark{width:38px;height:38px;border:2px solid var(--teal-dark);border-radius:10px;display:grid;place-items:center;font-weight:900;color:var(--teal-dark)}
.brand-copy strong{display:block;font-size:12px;letter-spacing:.2em}.brand-copy span{display:block;font-size:8px;color:var(--teal-dark);letter-spacing:.08em;margin-top:2px}.heading{min-width:0;flex:1}.heading h1{font-size:clamp(14px,2vw,20px);margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.heading p{font-size:11px;color:var(--muted);margin:4px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.course-progress{width:min(260px,24vw);flex:0 0 auto}.progress-meta{display:flex;justify-content:space-between;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.track{height:7px;border-radius:999px;background:#dceae7;overflow:hidden}.fill{width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--teal-dark),var(--teal));transition:width .35s ease}
main{min-height:0;padding:clamp(12px,2.4vw,28px);display:grid;place-items:center}.stage{width:min(1180px,100%);height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,300px);gap:clamp(14px,2vw,24px)}
.video-card{min-height:0;border:1px solid #bdd9d4;border-radius:20px;background:#062f2d;padding:clamp(8px,1.2vw,14px);box-shadow:0 24px 60px #0b51472b;display:grid;place-items:center;overflow:hidden}.video-wrap{width:100%;height:100%;min-height:0;display:grid;place-items:center;background:#021918;border-radius:13px;overflow:hidden}video{display:block;width:100%;height:100%;max-height:100%;object-fit:contain;background:#021918}
.side{border:1px solid var(--line);border-radius:20px;background:#fffffff0;padding:clamp(18px,2vw,26px);display:flex;flex-direction:column;min-height:0}.eyebrow{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.15em;color:var(--teal-dark)}.side h2{font-size:clamp(21px,2.4vw,31px);line-height:1.08;margin:12px 0}.description{font-size:13px;line-height:1.6;color:var(--muted);margin:0;overflow:auto}.stats{margin-top:auto;padding-top:20px;display:grid;gap:9px}.stat{padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--soft);display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10px;color:var(--muted)}.stat strong{font-size:12px;color:var(--ink)}
footer{min-height:58px;padding:10px clamp(16px,3vw,40px);display:flex;align-items:center;justify-content:space-between;gap:16px;border-top:1px solid var(--line);background:#fff}.status{font-size:10px;color:var(--muted)}.status strong{color:var(--teal-dark)}.actions{display:flex;align-items:center;gap:8px}.action{border:1px solid #b9d8d3;background:var(--soft);color:var(--ink);border-radius:10px;padding:9px 14px;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.action:hover,.action:focus-visible{background:#dff3ef;outline:2px solid #45c5bc66;outline-offset:2px}.video-card:fullscreen,.video-card:-webkit-full-screen{width:100%;height:100%;border:0;border-radius:0;padding:0;background:#000}.video-card:fullscreen .video-wrap,.video-card:-webkit-full-screen .video-wrap{border-radius:0;background:#000}.video-card:fullscreen video,.video-card:-webkit-full-screen video{background:#000}
@media(max-width:820px){html,body{overflow:auto}.shell{min-height:100%;height:auto;grid-template-rows:auto auto auto}.course-progress{width:120px}.stage{grid-template-columns:1fr;height:auto}.video-card{height:min(57vw,430px);min-height:220px}.side{min-height:190px}.description{overflow:visible}.stats{margin-top:18px;grid-template-columns:1fr 1fr}.brand-copy{display:none}}
@media(max-width:520px){header{min-height:62px;padding:10px 12px;gap:10px}.mark{width:34px;height:34px}.heading p{display:none}.course-progress{width:104px}.progress-meta span:first-child{display:none}main{padding:10px}.stage{gap:10px}.video-card{height:56vw;min-height:190px;border-radius:15px;padding:6px}.side{border-radius:15px;padding:16px}.side h2{font-size:21px;margin:8px 0}.description{font-size:12px}.stats{grid-template-columns:1fr}.stat{padding:9px 10px}footer{padding:9px 12px;position:sticky;bottom:0;align-items:flex-start}.status{font-size:9px}.actions{flex-direction:column;align-items:stretch}.action{padding:8px 10px}}
</style>
</head>
<body>
<div class="shell">
  <header>
    <div class="brand"><div class="mark">L</div><div class="brand-copy"><strong>LMSGEN</strong><span>VIDEO COURSE</span></div></div>
    <div class="heading"><h1 id="course-title"></h1><p>Tracked learning video · progress resumes automatically</p></div>
    <div class="course-progress"><div class="progress-meta"><span>Watched</span><span id="percent">0%</span></div><div class="track"><div class="fill" id="fill"></div></div></div>
  </header>
  <main>
    <div class="stage">
      <section class="video-card" id="video-card" aria-label="Course video"><div class="video-wrap"><video id="video" controls playsinline preload="metadata" controlslist="nodownload noremoteplayback" disablepictureinpicture><source id="video-source" /></video></div></section>
      <aside class="side"><div class="eyebrow">LMSGEN tracked video</div><h2 id="side-title"></h2><p class="description" id="description"></p><div class="stats"><div class="stat"><span>Watched coverage</span><strong id="coverage">0%</strong></div><div class="stat"><span>Current position</span><strong id="position">0:00</strong></div><div class="stat"><span>Course status</span><strong id="course-status">Not started</strong></div></div></aside>
    </div>
  </main>
  <footer><div class="status" id="status">Watch in order to complete this course. <strong>You can rewind, but cannot skip ahead.</strong></div><div class="actions"><button class="action" id="fullscreen" type="button">Full screen</button><button class="action" id="restart" type="button">Restart video</button></div></footer>
</div>
<script>
(function(){
  var BOOT=${boot};
  var video=document.getElementById('video'),source=document.getElementById('video-source'),videoCard=document.getElementById('video-card'),fullscreenButton=document.getElementById('fullscreen');
  var ranges=[],lastVideoTime=0,lastWall=0,furthestPosition=0,sessionStart=Date.now(),commitTimer=null,completed=false,playCount=0,seekCount=0,seeking=false,correctingSeek=false,noticeTimer=null;
  function byId(id){return document.getElementById(id)}
  function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
  function duration(){return Number.isFinite(video.duration)&&video.duration>0?video.duration:Number(BOOT.durationSeconds||0)}
  function merge(input){var sorted=(input||[]).map(function(r){return [Math.max(0,Number(r[0])||0),Math.max(0,Number(r[1])||0)]}).filter(function(r){return r[1]>r[0]}).sort(function(a,b){return a[0]-b[0]});var out=[];sorted.forEach(function(r){var prev=out[out.length-1];if(prev&&r[0]<=prev[1]+.35)prev[1]=Math.max(prev[1],r[1]);else out.push(r)});return out.slice(-120)}
  function watched(){return ranges.reduce(function(sum,r){return sum+Math.max(0,r[1]-r[0])},0)}
  function progress(){var d=duration();return d?clamp(Math.round(watched()/d*1000)/10,0,100):0}
  function clock(seconds){var n=Math.max(0,Math.floor(Number(seconds)||0)),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return (h?h+':':'')+(h?String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')}
  function sessionTime(){var ms=Math.max(0,Date.now()-sessionStart),total=Math.floor(ms/1000),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60,cs=Math.floor(ms%1000/10);return String(h).padStart(4,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0')}
  function setValue(k,v){try{if(typeof doLMSSetValue==='function')doLMSSetValue(k,String(v))}catch(e){}}
  function render(){var p=progress(),position=video.currentTime||0;byId('percent').textContent=Math.round(p)+'%';byId('fill').style.width=p+'%';byId('coverage').textContent=Math.round(p)+'%';byId('position').textContent=clock(position)+' / '+clock(duration());var status=completed?'Completed':p>0?'In progress':'Not started';byId('course-status').textContent=status;if(!noticeTimer)byId('status').innerHTML=completed?'Course completed. <strong>Your result has been saved.</strong>':'Watch in order to complete this course. <strong>You can rewind, but cannot skip ahead.</strong>'}
  function showNotice(message){if(noticeTimer)clearTimeout(noticeTimer);byId('status').innerHTML=message;noticeTimer=setTimeout(function(){noticeTimer=null;render()},2600)}
  function state(){return {v:2,videoPosition:Number(video.currentTime||0),furthestPosition:furthestPosition,videoDuration:duration(),ranges:ranges,quizmotoProgress:progress(),videoActiveSeconds:watched(),playCount:playCount,seekCount:seekCount,completed:completed}}
  function commit(exitMode){var p=progress();setValue('cmi.core.lesson_location',Math.floor(video.currentTime||0));setValue('cmi.suspend_data',JSON.stringify(state()));setValue('quizmoto.progress_percent',p);setValue('cmi.core.session_time',sessionTime());setValue('cmi.core.lesson_status',completed?'completed':'incomplete');setValue('cmi.core.exit',completed?'':(exitMode?'suspend':''));try{if(typeof doLMSCommit==='function')doLMSCommit()}catch(e){}render()}
  function restore(){try{var raw=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.suspend_data'):'';if(raw){var saved=JSON.parse(raw);ranges=merge(saved.ranges);completed=Boolean(saved.completed);playCount=Math.max(0,Number(saved.playCount)||0);seekCount=Math.max(0,Number(saved.seekCount)||0);furthestPosition=Math.max(0,Number(saved.furthestPosition)||Number(saved.videoPosition)||0);video.dataset.resume=String(Math.max(0,Number(saved.videoPosition)||0))}var lesson=typeof doLMSGetValue==='function'?doLMSGetValue('cmi.core.lesson_status'):'';if(/^(completed|passed)$/i.test(String(lesson||'')))completed=true}catch(e){}}
  function addPlayback(){if(video.paused||video.ended||seeking)return;var now=performance.now(),to=Number(video.currentTime||0),from=Number(lastVideoTime||0),elapsed=Math.max(0,(now-lastWall)/1000),allowed=elapsed*Math.max(.25,Number(video.playbackRate)||1)+1.25;if(to>=from&&to-from<=allowed&&to-from<=3.5){ranges=merge(ranges.concat([[from,to]]));furthestPosition=Math.max(furthestPosition,to)}lastVideoTime=to;lastWall=now;render()}
  function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement||null}
  function updateFullscreenLabel(){fullscreenButton.textContent=fullscreenElement()?'Exit full screen':'Full screen'}
  function toggleFullscreen(){if(fullscreenElement()){var exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit){var result=exit.call(document);if(result&&typeof result.catch==='function')result.catch(function(){})}return}if(typeof video.webkitEnterFullscreen==='function'){try{video.webkitEnterFullscreen();return}catch(e){}}var request=videoCard.requestFullscreen||videoCard.webkitRequestFullscreen;if(request){try{var result=request.call(videoCard);if(result&&typeof result.catch==='function')result.catch(function(){})}catch(e){}}}
  source.src=BOOT.mediaPath;source.type=BOOT.mimeType;byId('course-title').textContent=BOOT.title;byId('side-title').textContent=BOOT.title;byId('description').textContent=BOOT.description||'Watch the complete lesson. LMSGEN records genuine watched coverage, viewing time, completion and your resume position.';video.load();
  try{if(typeof doLMSInitialize==='function')doLMSInitialize()}catch(e){}restore();if(!completed)setValue('cmi.core.lesson_status','incomplete');commit(false);
  video.addEventListener('loadedmetadata',function(){var resume=Math.min(Math.max(0,Number(video.dataset.resume)||0),Math.max(0,duration()-1));furthestPosition=Math.max(furthestPosition,resume);if(resume>0)video.currentTime=resume;lastVideoTime=video.currentTime||0;lastWall=performance.now();render()});
  video.addEventListener('play',function(){playCount+=1;lastVideoTime=video.currentTime||0;lastWall=performance.now();render()});
  video.addEventListener('timeupdate',addPlayback);video.addEventListener('seeking',function(){seeking=true;seekCount+=1;var target=Number(video.currentTime||0),limit=Math.min(duration(),furthestPosition+.35);if(!completed&&!correctingSeek&&target>limit){correctingSeek=true;video.currentTime=Math.max(0,furthestPosition);showNotice('Skipping ahead is disabled. <strong>Please watch the lesson in order.</strong>')}});video.addEventListener('seeked',function(){seeking=false;correctingSeek=false;lastVideoTime=video.currentTime||0;lastWall=performance.now();commit(false)});video.addEventListener('pause',function(){addPlayback();commit(false)});
  video.addEventListener('ended',function(){var d=duration();if(furthestPosition>=Math.max(0,d-2)){furthestPosition=d;ranges=merge(ranges.concat([[Math.max(0,d-1.5),d]]))}completed=furthestPosition>=Math.max(0,d-1)&&progress()>=95;commit(false)});
  document.getElementById('restart').addEventListener('click',function(){video.currentTime=0;lastVideoTime=0;lastWall=performance.now();video.play().catch(function(){});commit(false)});
  fullscreenButton.addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',updateFullscreenLabel);document.addEventListener('webkitfullscreenchange',updateFullscreenLabel);
  commitTimer=setInterval(function(){if(!video.paused)addPlayback();commit(false)},5000);
  document.addEventListener('visibilitychange',function(){if(document.hidden)commit(true)});window.addEventListener('pagehide',function(){commit(true)});window.addEventListener('beforeunload',function(){commit(true);if(commitTimer)clearInterval(commitTimer);try{if(typeof doLMSFinish==='function')doLMSFinish()}catch(e){}});
})();
</script>
</body>
</html>`;
}

function manifestXml({ title, mediaPath }) {
    const safeTitle = xml(title || 'Video course');
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.lmsgen.video.${Date.now()}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG-1"><organization identifier="ORG-1"><title>${safeTitle}</title><item identifier="ITEM-1" identifierref="RES-1"><title>${safeTitle}</title></item></organization></organizations>
  <resources><resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/><file href="scorm_api_wrapper.js"/><file href="${xml(mediaPath)}"/></resource></resources>
</manifest>`;
}

async function createZipFile({ outputPath, videoPath, mediaPath, html, manifest }) {
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', { zlib: { level: 6 } });
        output.once('close', resolve);
        output.once('error', reject);
        archive.once('error', reject);
        archive.on('warning', (error) => {
            if (error.code !== 'ENOENT') reject(error);
        });
        archive.pipe(output);
        archive.append(Buffer.from(html), { name: 'index.html' });
        archive.append(Buffer.from(SCORM_WRAPPER), { name: 'scorm_api_wrapper.js' });
        archive.append(Buffer.from(manifest), { name: 'imsmanifest.xml' });
        archive.file(videoPath, { name: mediaPath, store: true });
        const finalizing = archive.finalize();
        if (finalizing && typeof finalizing.catch === 'function') finalizing.catch(reject);
    });
}

function readAnalysis(value) {
    try {
        const parsed = JSON.parse(String(value || '{}'));
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

async function createVideoCourse({ hostId, title, description, mimeType, durationSeconds, sourcePath, tempDir, replacePackageId = '' }) {
    let pkg = null;
    let createdPackage = false;
    const storage = getObjectStorage();
    try {
        const safeTitle = String(title || 'Video course').trim().slice(0, 200) || 'Video course';
        const safeDescription = String(description || '').trim().slice(0, 1200) || null;
        const sourceStat = await fsp.stat(sourcePath);
        const extension = videoExtension(mimeType);
        const mediaPath = `media/course-video.${extension}`;
        const html = playerHtml({ title: safeTitle, description: safeDescription, mediaPath, mimeType, durationSeconds });
        const manifest = manifestXml({ title: safeTitle, mediaPath });
        const manifestHash = crypto.createHash('sha256').update(manifest).digest('hex');

        if (replacePackageId) {
            pkg = await ScormPackage.findOne({ where: { id: replacePackageId, hostId } });
            if (!pkg || pkg.status === 'deleted' || pkg.source !== 'video_course') {
                const error = new Error('Editable video course not found.');
                error.status = 404;
                error.code = 'VIDEO_COURSE_NOT_FOUND';
                throw error;
            }
        } else {
            pkg = await ScormPackage.create({
                hostId,
                title: safeTitle,
                description: safeDescription,
                status: 'processing',
                source: 'video_course',
                standard: 'scorm_1_2',
                byteSize: sourceStat.size,
                analysisJson: JSON.stringify({
                    generatedBy: 'lmsgen',
                    type: 'video_course',
                    title: safeTitle,
                    description: safeDescription,
                    mimeType,
                    durationSeconds: Number(durationSeconds) || null,
                    revision: 1
                })
            });
            createdPackage = true;
        }

        const zipPath = path.join(tempDir, 'video-course.zip');
        await createZipFile({ outputPath: zipPath, videoPath: sourcePath, mediaPath, html, manifest });
        const zipStat = await fsp.stat(zipPath);
        const zipKey = packageZipKey(pkg.id);

        // Publish the replacement media first and the entry document last so a
        // learner can never receive a new player that points at an unavailable file.
        await storage.putObjectStream({ key: packageContentKey(pkg.id, mediaPath), stream: fs.createReadStream(sourcePath), contentType: mimeType, contentLength: sourceStat.size });
        await storage.putObject({ key: packageContentKey(pkg.id, 'scorm_api_wrapper.js'), body: Buffer.from(SCORM_WRAPPER), contentType: 'application/javascript' });
        await storage.putObject({ key: packageContentKey(pkg.id, 'imsmanifest.xml'), body: Buffer.from(manifest), contentType: 'application/xml' });
        await storage.putObject({ key: packageContentKey(pkg.id, 'index.html'), body: Buffer.from(html), contentType: 'text/html; charset=utf-8' });
        await storage.putObjectStream({ key: zipKey, stream: fs.createReadStream(zipPath), contentType: 'application/zip', contentLength: zipStat.size });

        const meta = {
            entryHref: 'index.html',
            manifestPath: 'imsmanifest.xml',
            standard: 'scorm_1_2',
            fileCount: 4,
            manifestHash,
            totalUncompressed: sourceStat.size + Buffer.byteLength(html) + Buffer.byteLength(SCORM_WRAPPER) + Buffer.byteLength(manifest),
            courseType: 'video_course'
        };
        await storage.putObject({ key: packageMetaKey(pkg.id), body: Buffer.from(JSON.stringify(meta, null, 2)), contentType: 'application/json' });

        const previousAnalysis = readAnalysis(pkg.analysisJson);
        pkg.title = safeTitle;
        pkg.description = safeDescription;
        pkg.source = 'video_course';
        pkg.standard = 'scorm_1_2';
        pkg.analysisJson = JSON.stringify({
            generatedBy: 'lmsgen',
            type: 'video_course',
            title: safeTitle,
            description: safeDescription,
            mimeType,
            durationSeconds: Number(durationSeconds) || null,
            revision: Math.max(0, Number(previousAnalysis.revision) || 0) + (createdPackage ? 0 : 1),
            replacedAt: createdPackage ? null : new Date().toISOString()
        });
        pkg.storageKeyZip = zipKey;
        pkg.storagePrefixContent = packageContentPrefix(pkg.id);
        pkg.entryHref = 'index.html';
        pkg.manifestHash = manifestHash;
        pkg.byteSize = zipStat.size;
        pkg.fileCount = 4;
        pkg.status = 'ready';
        pkg.errorMessage = null;
        await pkg.save();

        const course = await ensureCourseForPackage({ packageId: pkg.id, hostId, title: safeTitle });
        if (!course) throw new Error('The video package was created but its course workspace could not be prepared.');
        course.title = safeTitle;
        course.description = safeDescription;
        course.settings = {
            ...(course.settings && typeof course.settings === 'object' ? course.settings : {}),
            courseType: 'video_course',
            durationSeconds: Number(durationSeconds) || null,
            videoRevision: Math.max(1, Number(readAnalysis(pkg.analysisJson).revision) || 1)
        };
        await course.save();

        return { package: pkg, course };
    } catch (error) {
        if (pkg && createdPackage) {
            pkg.status = 'failed';
            pkg.errorMessage = String(error.message || 'Video course creation failed.').slice(0, 2000);
            await pkg.save().catch(() => {});
            await deletePackageFromStorage(pkg.id, pkg.storageKeyZip).catch(() => {});
        }
        throw error;
    }
}

module.exports = {
    VIDEO_TYPES,
    SCORM_WRAPPER,
    acceptedVideoType,
    videoExtension,
    playerHtml,
    manifestXml,
    createZipFile,
    createVideoCourse,
    readAnalysis
};
