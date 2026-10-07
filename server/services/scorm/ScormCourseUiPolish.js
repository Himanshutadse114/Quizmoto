const COURSE_UI_POLISH_STYLE_ID = 'quizmoto-course-ui-polish-v1';
const COURSE_UI_POLISH_SCRIPT_ID = 'quizmoto-course-ui-polish-script-v1';

const SPEAKER_OFF_MASK = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M11%205%206%209H2v6h4l5%204z'/%3E%3Cpath%20d='m22%209-6%206'/%3E%3Cpath%20d='m16%209%206%206'/%3E%3C/svg%3E";
const SPEAKER_ON_MASK = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M11%205%206%209H2v6h4l5%204z'/%3E%3Cpath%20d='M15.54%208.46a5%205%200%200%201%200%207.07'/%3E%3Cpath%20d='M19.07%204.93a10%2010%200%200%201%200%2014.14'/%3E%3C/svg%3E";

function courseUiPolishStyle() {
    return `<style id="${COURSE_UI_POLISH_STYLE_ID}">
/* Course header: remove the generated Q badge while preserving an uploaded logo. */
header .brand-mark{display:none!important}

/* Narration stays an accessible button, but is presented as a simple speaker vector only. */
#qmx-narration-toggle{
  width:34px!important;
  min-width:34px!important;
  height:34px!important;
  min-height:34px!important;
  padding:0!important;
  margin:0!important;
  border:0!important;
  border-radius:7px!important;
  background:transparent!important;
  box-shadow:none!important;
  color:var(--ink,var(--text,#282824))!important;
  display:inline-grid!important;
  place-items:center!important;
  flex:0 0 34px!important;
  font-size:0!important;
  line-height:0!important;
  text-indent:-9999px!important;
  overflow:hidden!important;
  cursor:pointer!important;
}
#qmx-narration-toggle::before{
  content:""!important;
  width:19px!important;
  height:19px!important;
  display:block!important;
  background:currentColor!important;
  -webkit-mask-image:url("${SPEAKER_OFF_MASK}")!important;
  mask-image:url("${SPEAKER_OFF_MASK}")!important;
  -webkit-mask-repeat:no-repeat!important;
  mask-repeat:no-repeat!important;
  -webkit-mask-position:center!important;
  mask-position:center!important;
  -webkit-mask-size:contain!important;
  mask-size:contain!important;
}
#qmx-narration-toggle[aria-pressed="true"]::before{
  -webkit-mask-image:url("${SPEAKER_ON_MASK}")!important;
  mask-image:url("${SPEAKER_ON_MASK}")!important;
}
#qmx-narration-toggle:hover{background:rgba(40,40,36,.06)!important}
#qmx-narration-toggle:focus-visible{outline:2px solid currentColor!important;outline-offset:2px!important}

/* Assessment questions should read like normal course copy, not oversized headings. */
.slide[data-kind="quiz"] .qmx-quiz-shell,
.slide[data-kind="quiz"] .quiz-card{
  text-align:left!important;
}
.slide[data-kind="quiz"] .qmx-quiz-shell h2,
.slide[data-kind="quiz"] .quiz-card h2,
.slide[data-kind="quiz"] .quiz-card .title,
.qmx-quiz-shell h2,
.quiz-card h2{
  font-size:17px!important;
  font-weight:400!important;
  line-height:1.5!important;
  letter-spacing:0!important;
  text-align:left!important;
  margin:0 0 18px!important;
}

/*
 * Course contents is useful on a maximised/full-size browser, but becomes a
 * large permanent tax on the learner canvas when the browser is restored or
 * resized. Hide it by default and let the shared runtime opt it in only when
 * the browser is effectively using the full available desktop window.
 */
html:not(.qmx-course-menu-full-window) .qmx-course-sidebar,
html:not(.qmx-course-menu-full-window) .qmx-scenario-sidebar{display:none!important}
html.qmx-course-menu-full-window body[data-qmx-course-template] .qmx-course-sidebar,
html.qmx-course-menu-full-window body[data-qmx-course-template] .qmx-scenario-sidebar{display:flex!important}

/*
 * Professional no-image slides should use the canvas rather than looking like
 * a small strip floating in the middle of a tall screen. The old flip cards
 * remain the interaction; only their desktop presentation gets more vertical
 * presence. Short windows automatically fall back to compact card heights.
 */
body[data-qmx-course-template="professional-classic"] .slide[data-kind="learning"].active{
  padding-top:16px!important;
  padding-bottom:16px!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image{
  width:min(1280px,100%)!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-copy{
  column-gap:clamp(36px,4vw,58px)!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-cards.qmx-flip-grid{
  max-width:620px!important;
  gap:14px!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-inner,
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-face{
  min-height:190px!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-face{
  padding:18px 18px!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-title{
  font-size:15px!important;
  line-height:1.3!important;
}
body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-back p{
  font-size:13px!important;
  line-height:1.5!important;
}

@media(max-height:760px){
  body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-inner,
  body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-face{min-height:145px!important}
  body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-face{padding:14px 15px!important}
}
@media(max-width:1100px){
  body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-inner,
  body[data-qmx-course-template="professional-classic"] .qmx-learning-shell.no-image .qmx-flip-face{min-height:138px!important}
}
@media(max-width:680px){
  .slide[data-kind="quiz"] .qmx-quiz-shell h2,
  .slide[data-kind="quiz"] .quiz-card h2,
  .slide[data-kind="quiz"] .quiz-card .title,
  .qmx-quiz-shell h2,
  .quiz-card h2{font-size:16px!important;line-height:1.5!important}
  #qmx-narration-toggle{width:32px!important;min-width:32px!important;height:32px!important;min-height:32px!important;flex-basis:32px!important}
  #qmx-narration-toggle::before{width:18px!important;height:18px!important}
}
</style>`;
}

function courseUiPolishScript() {
    return `<script id="${COURSE_UI_POLISH_SCRIPT_ID}">
(function(){
  var root=document.documentElement;
  var resizeTimer=null;

  function isEffectivelyFullWindow(){
    var screenInfo=window.screen||{};
    var availableWidth=Number(screenInfo.availWidth||screenInfo.width||0);
    var availableHeight=Number(screenInfo.availHeight||screenInfo.height||0);
    var outerWidth=Number(window.outerWidth||window.innerWidth||0);
    var outerHeight=Number(window.outerHeight||window.innerHeight||0);
    var viewportWide=Number(window.innerWidth||0)>=1100;
    var viewportTall=Number(window.innerHeight||0)>=560;
    var explicitFullscreen=Boolean(document.fullscreenElement||window.fullScreen===true);

    if(!viewportWide||!viewportTall)return false;
    if(explicitFullscreen)return true;
    if(!availableWidth||!availableHeight){
      return Number(window.innerWidth||0)>=1360&&Number(window.innerHeight||0)>=720;
    }

    /* Allow normal browser chrome/taskbar differences while still rejecting a restored window. */
    return outerWidth>=availableWidth-36&&outerHeight>=availableHeight-96;
  }

  function syncMenuVisibility(){
    root.classList.toggle('qmx-course-menu-full-window',isEffectivelyFullWindow());
  }

  function scheduleSync(){
    if(resizeTimer)window.clearTimeout(resizeTimer);
    resizeTimer=window.setTimeout(syncMenuVisibility,80);
  }

  syncMenuVisibility();
  window.addEventListener('resize',scheduleSync,{passive:true});
  window.addEventListener('orientationchange',scheduleSync,{passive:true});
  window.addEventListener('load',syncMenuVisibility,{once:true});
  document.addEventListener('fullscreenchange',syncMenuVisibility);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)scheduleSync();});
  window.setTimeout(syncMenuVisibility,160);
})();
</script>`;
}

function injectCourseUiPolish(source) {
    let html = String(source || '');
    if (!html) return html;

    const additions = [];
    if (!html.includes(COURSE_UI_POLISH_STYLE_ID)) additions.push(courseUiPolishStyle());
    if (!html.includes(COURSE_UI_POLISH_SCRIPT_ID)) additions.push(courseUiPolishScript());
    if (!additions.length) return html;

    const patch = additions.join('\n');
    html = html.includes('</head>')
        ? html.replace('</head>', `${patch}\n</head>`)
        : `${patch}\n${html}`;
    return html;
}

module.exports = {
    COURSE_UI_POLISH_STYLE_ID,
    COURSE_UI_POLISH_SCRIPT_ID,
    courseUiPolishStyle,
    courseUiPolishScript,
    injectCourseUiPolish
};
