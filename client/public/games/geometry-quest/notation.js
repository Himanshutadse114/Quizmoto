(() => {
  'use strict';

  const data = window.GeometryGameData;
  if (!data?.levels) return;

  function explicitEquation(raw) {
    if (typeof raw !== 'string') return raw;
    const original = raw.trim();
    if (!original) return original;

    const semi = original.indexOf(';');
    const expression = (semi >= 0 ? original.slice(0, semi) : original).trim();
    const domain = semi >= 0 ? original.slice(semi + 1).trim() : '';

    // Already an explicit y= / x= equation or an implicit equation such as a circle.
    if (expression.includes('=')) {
      return domain ? `${expression}; ${domain}` : expression;
    }

    // A bare expression is a function of x, so present it to the learner as y = f(x).
    return `y = ${expression}${domain ? `; ${domain}` : ''}`;
  }

  // Keep backwards-compatible engine shorthand in the parser, but never teach that
  // shorthand to the learner. All target and perfect-solution formulas are explicit.
  for (const level of data.levels) {
    const sourceFormulas = [...(level.target || []), ...(level.solution || [])];

    if (level.target) level.target = level.target.map(explicitEquation);
    if (level.solution) level.solution = level.solution.map(explicitEquation);

    if (typeof level.hint === 'string') {
      let hint = level.hint;
      for (const formula of sourceFormulas) {
        const explicit = explicitEquation(formula);
        if (explicit !== formula) hint = hint.split(formula).join(explicit);
      }
      level.hint = hint;
    }
  }

  function normaliseInput() {
    const input = document.querySelector('#formulaInput');
    if (!input || !input.value.trim()) return;
    const normalised = explicitEquation(input.value);
    if (normalised === input.value.trim()) return;
    input.value = normalised;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Run before the game's normal click/submit handlers (capture phase) so any shorthand
  // a learner types is stored and displayed using proper mathematical notation.
  document.querySelector('#addFormulaBtn')?.addEventListener('click', normaliseInput, true);
  document.querySelector('#formulaForm')?.addEventListener('submit', normaliseInput, true);
  document.querySelector('#formulaInput')?.addEventListener('blur', normaliseInput);

  // Make the equation shortcuts teach the full left-hand side too.
  const yKey = document.querySelector('.math-key[data-key="y"]');
  if (yKey) {
    yKey.dataset.key = 'y = ';
    yKey.textContent = 'y =';
    yKey.setAttribute('aria-label', 'Insert y equals');
  }
  const xKey = document.querySelector('.math-key[data-key="x"]');
  if (xKey) {
    xKey.dataset.key = 'x = ';
    xKey.textContent = 'x =';
    xKey.setAttribute('aria-label', 'Insert x equals');
  }

  window.GeometryNotation = { explicitEquation };
})();
