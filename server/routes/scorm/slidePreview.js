const express = require('express');
const router = express.Router();
const { verifyRegistrationToken } = require('../../services/scorm/ScormInviteService');
const { ScormRegistration, ScormCourse, ScormPackage } = require('../../models/scorm');

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

router.get('/:regId', async (req, res) => {
    try {
        const token = String(req.query.token || '');
        if (!token) return res.status(400).send('Missing preview token');

        let decoded;
        try {
            decoded = verifyRegistrationToken(token);
        } catch (_) {
            return res.status(401).send('Invalid or expired preview token');
        }

        if (String(decoded.scormRegId) !== String(req.params.regId)) {
            return res.status(403).send('Preview token does not match registration');
        }

        const registration = await ScormRegistration.findByPk(req.params.regId, {
            include: [{
                model: ScormCourse,
                as: 'course',
                include: [{ model: ScormPackage, as: 'package' }]
            }]
        });

        if (!registration || !registration.isPreview || registration.status === 'revoked') {
            return res.status(404).send('Preview registration not found');
        }
        if (!registration.course || !registration.course.package || registration.course.package.status !== 'ready') {
            return res.status(409).send('Generated course is not ready');
        }

        const requestedSlide = Number.parseInt(String(req.query.slide || '0'), 10);
        const targetSlide = Number.isFinite(requestedSlide) && requestedSlide >= 0 ? requestedSlide : 0;
        const playUrl = `/api/scorm/play/${encodeURIComponent(String(registration.id))}?token=${encodeURIComponent(token)}`;
        const title = escapeHtml(registration.course.title || registration.course.package.title || 'Course slide preview');

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05070d}
#player{position:absolute;inset:0;width:100%;height:100%;border:0;background:#05070d}
#loading{position:absolute;inset:0;z-index:3;display:grid;place-items:center;background:#05070d;color:#dce6f2;font:600 13px/1.4 system-ui,sans-serif;letter-spacing:.01em}
#loading.hidden{display:none}
</style>
</head>
<body>
<div id="loading">Loading exact generated slide…</div>
<iframe id="player" title="Exact generated course slide" src="${playUrl}" allow="autoplay; fullscreen" allowfullscreen></iframe>
<script>
(function(){
  var TARGET=${JSON.stringify(targetSlide)};
  var player=document.getElementById('player');
  var loading=document.getElementById('loading');
  var attempts=0;
  var locked=false;

  function hidePlayerChrome(doc){
    try{
      doc.documentElement.style.height='100%';
      doc.body.style.height='100%';
      doc.body.style.overflow='hidden';
      var bar=doc.getElementById('bar');
      if(bar)bar.style.display='none';
      var frame=doc.getElementById('frame');
      if(frame){
        frame.style.position='absolute';
        frame.style.inset='0';
        frame.style.width='100%';
        frame.style.height='100%';
      }
    }catch(e){}
  }

  function lockNavigation(doc){
    if(locked)return;
    locked=true;
    ['prev-btn','next-btn'].forEach(function(id){
      var button=doc.getElementById(id);
      if(button){
        button.style.pointerEvents='none';
        button.setAttribute('aria-disabled','true');
        button.setAttribute('tabindex','-1');
      }
    });
    doc.addEventListener('keydown',function(event){
      if(['ArrowLeft','ArrowRight','PageUp','PageDown'].indexOf(event.key)!==-1){
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },true);
  }

  function finish(doc){
    lockNavigation(doc);
    if(loading)loading.classList.add('hidden');
  }

  function tune(){
    attempts+=1;
    if(attempts>180){
      if(loading)loading.textContent='Unable to load the generated slide preview.';
      return;
    }

    try{
      var playerDoc=player.contentDocument;
      if(!playerDoc){setTimeout(tune,80);return;}
      hidePlayerChrome(playerDoc);

      var courseFrame=playerDoc.getElementById('frame');
      if(!courseFrame){setTimeout(tune,80);return;}
      var courseDoc=courseFrame.contentDocument;
      if(!courseDoc){setTimeout(tune,80);return;}

      var slides=Array.prototype.slice.call(courseDoc.querySelectorAll('.slide'));
      if(!slides.length){setTimeout(tune,80);return;}

      var target=Math.max(0,Math.min(TARGET,slides.length-1));
      var active=courseDoc.querySelector('.slide.active');
      var current=slides.indexOf(active);
      if(current<0)current=0;

      if(current===target){finish(courseDoc);return;}

      var button=courseDoc.getElementById(current<target?'next-btn':'prev-btn');
      if(button){
        button.click();
        setTimeout(tune,70);
        return;
      }

      slides.forEach(function(slide,index){slide.classList.toggle('active',index===target);});
      finish(courseDoc);
    }catch(e){
      setTimeout(tune,100);
    }
  }

  player.addEventListener('load',function(){attempts=0;setTimeout(tune,80);});
  setTimeout(tune,120);
})();
</script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https: http:");
        res.send(html);
    } catch (err) {
        console.error('[scorm-slide-preview] failed', err);
        res.status(500).send('Unable to load slide preview');
    }
});

module.exports = router;
