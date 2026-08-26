const COURSE_INTERACTION_STYLE_ID = 'quizmoto-course-interactions-v1';
const COURSE_INTERACTION_SCRIPT_ID = 'quizmoto-course-interactions-script-v1';

function courseInteractionStyle() {
    return `<style id="${COURSE_INTERACTION_STYLE_ID}">
/* Interactive learning cards: compact click/tap or keyboard reveal cards. */
.qmx-cards { perspective: 1200px; }
.qmx-cards.qmx-flip-grid {
  grid-template-columns: repeat(2,minmax(220px,280px)) !important;
  gap: 12px !important;
  max-width: 572px;
  align-items: stretch;
  justify-content: start;
}

/* No-image slides keep the reading content on the left and use the visual column for interactions. */
.qmx-learning-shell.no-image {
  width: min(1180px,100%) !important;
  margin-inline: auto !important;
}
.qmx-learning-shell.no-image .qmx-copy {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0,1.08fr) minmax(420px,.92fr);
  column-gap: 42px;
  row-gap: 0;
  align-items: start;
  text-align: left;
}
.qmx-learning-shell.no-image .qmx-copy > .eyebrow,
.qmx-learning-shell.no-image .qmx-copy > h2,
.qmx-learning-shell.no-image .qmx-copy > p {
  grid-column: 1;
}
.qmx-learning-shell.no-image .qmx-copy > .eyebrow { grid-row: 1; }
.qmx-learning-shell.no-image .qmx-copy > h2 {
  grid-row: 2;
  max-width: 720px;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.qmx-learning-shell.no-image .qmx-copy > p {
  grid-row: 3;
  max-width: 650px !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.qmx-learning-shell.no-image .qmx-cards,
.qmx-learning-shell.no-image .qmx-process,
.qmx-learning-shell.no-image .qmx-compare {
  grid-column: 2;
  grid-row: 1 / span 3;
  align-self: center;
  justify-self: end;
  width: 100%;
  margin: 0 !important;
}
.qmx-learning-shell.no-image .qmx-cards.qmx-flip-grid {
  grid-template-columns: repeat(2,minmax(0,1fr)) !important;
  max-width: 560px;
  justify-content: stretch !important;
}
.qmx-learning-shell.no-image .qmx-step,
.qmx-learning-shell.no-image .qmx-compare-col,
.qmx-learning-shell.no-image .qmx-flip-face,
.qmx-learning-shell.no-image .qmx-flip-back p {
  text-align: left;
}
.qmx-learning-shell.no-image .qmx-card.qmx-flip-card .qmx-flip-number {
  align-self: flex-start !important;
}

.qmx-card.qmx-flip-card {
  min-height: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  cursor: pointer;
  outline: none;
  perspective: 1200px;
  align-self: stretch;
}
.qmx-flip-inner {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 112px;
  transform-style: preserve-3d;
  transition: transform .55s cubic-bezier(.2,.72,.22,1);
}
.qmx-flip-card.is-flipped .qmx-flip-inner { transform: rotateY(180deg); }
.qmx-flip-face {
  position: relative;
  grid-area: 1 / 1;
  min-height: 112px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
  padding: 13px 14px;
  border: 1px solid var(--paper-3);
  border-radius: 12px;
  background: var(--surface);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  box-shadow: 0 7px 18px rgba(15,23,42,.055);
  overflow: hidden;
}
.qmx-flip-front {
  background: var(--surface);
  border-color: var(--paper-3);
}
.qmx-flip-back {
  transform: rotateY(180deg);
  border-color: var(--accent);
  background: var(--surface);
}
.qmx-card.qmx-flip-card .qmx-flip-number {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  align-self: flex-start !important;
  flex: 0 0 28px !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 8px;
  background: var(--soft);
  color: var(--primary-dark);
  font-size: 10px !important;
  line-height: 1 !important;
  font-weight: 700 !important;
  text-align: center;
}
.qmx-flip-title {
  margin-top: 2px;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.25;
  font-weight: 600;
}
.qmx-flip-hint {
  margin-top: auto;
  padding-top: 4px;
  color: var(--primary-dark);
  font-size: 8.5px;
  line-height: 1.2;
  font-weight: 600;
  letter-spacing: .075em;
  text-transform: uppercase;
}
.qmx-flip-back p {
  margin: 2px 0 0 !important;
  color: var(--ink-soft) !important;
  font-size: 12.5px !important;
  line-height: 1.42 !important;
  font-weight: 500 !important;
}
.qmx-flip-card:hover .qmx-flip-face,
.qmx-flip-card:focus-visible .qmx-flip-face {
  border-color: var(--accent);
  box-shadow: 0 9px 22px rgba(15,23,42,.085);
}
.qmx-flip-card:focus-visible .qmx-flip-face { outline: 2px solid var(--primary); outline-offset: 2px; }
#next-btn[data-qmx-reveal-locked="true"] { opacity: .38 !important; cursor: not-allowed !important; }
@media(max-width:980px){
  .qmx-learning-shell.no-image .qmx-copy{display:block;text-align:left}
  .qmx-learning-shell.no-image .qmx-copy>h2{max-width:none}
  .qmx-learning-shell.no-image .qmx-copy>p{max-width:840px!important}
  .qmx-learning-shell.no-image .qmx-cards,
  .qmx-learning-shell.no-image .qmx-process,
  .qmx-learning-shell.no-image .qmx-compare{width:100%;max-width:572px;margin-top:22px!important;justify-self:start}
}
@media(max-width:760px){
  .qmx-cards.qmx-flip-grid{grid-template-columns:minmax(0,1fr) !important;max-width:420px}
  .qmx-learning-shell.no-image .qmx-cards.qmx-flip-grid{grid-template-columns:minmax(0,1fr) !important;max-width:420px}
}
@media(max-width:620px){
  .qmx-learning-shell.no-image{width:100%!important}
  .qmx-flip-inner,.qmx-flip-face{min-height:106px}
  .qmx-flip-face{padding:12px 13px}
  .qmx-card.qmx-flip-card .qmx-flip-number{width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;flex-basis:26px!important}
}
@media(prefers-reduced-motion:reduce){
  .qmx-flip-inner{transition:none!important}
}
</style>`;
}

function courseInteractionScript() {
    return `<script id="${COURSE_INTERACTION_SCRIPT_ID}">
(function(){
  function clean(value){ return String(value || '').replace(/\\s+/g,' ').trim(); }

  function makeNode(tag, className, text){
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function upgradeCard(card, index){
    if (!card || card.getAttribute('data-qmx-flip-ready') === 'true') return;
    var numberNode = card.querySelector('span');
    var copyNode = card.querySelector('p');
    var number = clean(numberNode && numberNode.textContent) || String(index + 1).padStart(2,'0');
    var copy = clean(copyNode && copyNode.textContent);
    if (!copy) return;

    card.textContent = '';
    card.classList.add('qmx-flip-card');
    card.setAttribute('data-qmx-flip-ready','true');
    card.setAttribute('data-qmx-revealed','false');
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-expanded','false');
    card.setAttribute('aria-label','Reveal key point ' + number);

    var inner = makeNode('div','qmx-flip-inner');
    var front = makeNode('div','qmx-flip-face qmx-flip-front');
    var back = makeNode('div','qmx-flip-face qmx-flip-back');

    front.appendChild(makeNode('span','qmx-flip-number',number));
    front.appendChild(makeNode('div','qmx-flip-title','Key point ' + number));
    front.appendChild(makeNode('div','qmx-flip-hint','Click to reveal'));

    back.appendChild(makeNode('span','qmx-flip-number',number));
    back.appendChild(makeNode('p','',copy));
    back.appendChild(makeNode('div','qmx-flip-hint','Click to flip back'));

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
  }

  function upgradeCards(){
    Array.prototype.forEach.call(document.querySelectorAll('.slide[data-kind="learning"] .qmx-cards'), function(grid){
      var cards = grid.querySelectorAll('.qmx-card');
      if (!cards.length) return;
      if (!grid.classList.contains('qmx-flip-grid')) grid.classList.add('qmx-flip-grid');
      Array.prototype.forEach.call(cards, upgradeCard);
    });
  }

  function activeSlide(){ return document.querySelector('.slide.active'); }

  function unrevealedCards(slide){
    if (!slide) return [];
    return Array.prototype.filter.call(slide.querySelectorAll('.qmx-flip-card'), function(card){
      return card.getAttribute('data-qmx-revealed') !== 'true';
    });
  }

  function syncNextGate(){
    var next = document.getElementById('next-btn');
    if (!next) return;
    var slide = activeSlide();
    var cards = slide ? slide.querySelectorAll('.qmx-flip-card') : [];
    var locked = cards.length > 0 && unrevealedCards(slide).length > 0;
    if (locked) {
      next.disabled = true;
      next.setAttribute('data-qmx-reveal-locked','true');
      next.title = 'Reveal every key point before continuing';
      next.setAttribute('aria-label','Reveal every key point before continuing');
    } else {
      if (next.getAttribute('data-qmx-reveal-locked') === 'true') next.disabled = false;
      next.removeAttribute('data-qmx-reveal-locked');
      next.removeAttribute('title');
      next.removeAttribute('aria-label');
    }
  }

  function toggleCard(card){
    if (!card) return;
    var flipped = !card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', flipped);
    if (flipped) card.setAttribute('data-qmx-revealed','true');
    card.setAttribute('aria-expanded', flipped ? 'true' : 'false');
    card.setAttribute('aria-label', (flipped ? 'Hide' : 'Reveal') + ' key point');
    syncNextGate();
  }

  document.addEventListener('click', function(event){
    var card = event.target && event.target.closest ? event.target.closest('.qmx-flip-card') : null;
    if (card) toggleCard(card);
  }, false);

  document.addEventListener('keydown', function(event){
    var card = event.target && event.target.closest ? event.target.closest('.qmx-flip-card') : null;
    if (!card || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggleCard(card);
  }, false);

  function blockLockedNext(event){
    var next = event.target && event.target.closest ? event.target.closest('#next-btn') : null;
    if (!next) return;
    var slide = activeSlide();
    if (!unrevealedCards(slide).length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    syncNextGate();
  }

  function syncAfterNavigation(event){
    var nav = event.target && event.target.closest ? event.target.closest('#next-btn,#prev-btn') : null;
    if (!nav) return;
    setTimeout(syncNextGate, 0);
  }

  function install(){
    upgradeCards();
    syncNextGate();
    document.addEventListener('click', blockLockedNext, true);
    document.addEventListener('click', syncAfterNavigation, false);
    window.addEventListener('load', function(){ setTimeout(syncNextGate, 0); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
</script>`;
}

function injectCourseInteractionsUi(html) {
    let source = String(html || '');
    if (!source) return source;

    if (!source.includes(COURSE_INTERACTION_STYLE_ID)) {
        const style = courseInteractionStyle();
        source = source.includes('</head>') ? source.replace('</head>', `${style}\n</head>`) : `${style}\n${source}`;
    }

    if (!source.includes(COURSE_INTERACTION_SCRIPT_ID)) {
        const script = courseInteractionScript();
        source = source.includes('</body>') ? source.replace('</body>', `${script}\n</body>`) : `${source}\n${script}`;
    }

    return source;
}

module.exports = {
    COURSE_INTERACTION_STYLE_ID,
    COURSE_INTERACTION_SCRIPT_ID,
    courseInteractionStyle,
    courseInteractionScript,
    injectCourseInteractionsUi
};
