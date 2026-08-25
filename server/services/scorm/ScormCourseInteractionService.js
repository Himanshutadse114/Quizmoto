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
  background: linear-gradient(145deg,var(--surface),var(--soft));
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
@media(max-width:760px){
  .qmx-cards.qmx-flip-grid{grid-template-columns:minmax(0,1fr) !important;max-width:420px}
}
@media(max-width:620px){
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
      grid.classList.add('qmx-flip-grid');
      Array.prototype.forEach.call(cards, upgradeCard);
    });
  }

  function toggleCard(card){
    if (!card) return;
    var flipped = !card.classList.contains('is-flipped');
    card.classList.toggle('is-flipped', flipped);
    card.setAttribute('aria-expanded', flipped ? 'true' : 'false');
    card.setAttribute('aria-label', (flipped ? 'Hide' : 'Reveal') + ' key point');
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

  function install(){
    upgradeCards();
    var main = document.querySelector('main');
    if (main && typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(upgradeCards);
      observer.observe(main,{subtree:true,childList:true});
    }
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
