const COURSE_UI_POLISH_STYLE_ID = 'quizmoto-course-ui-polish-v1';

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

function injectCourseUiPolish(source) {
    const html = String(source || '');
    if (!html || html.includes(COURSE_UI_POLISH_STYLE_ID)) return html;
    const style = courseUiPolishStyle();
    return html.includes('</head>')
        ? html.replace('</head>', `${style}\n</head>`)
        : `${style}\n${html}`;
}

module.exports = {
    COURSE_UI_POLISH_STYLE_ID,
    courseUiPolishStyle,
    injectCourseUiPolish
};
