(() => {
  'use strict';

  const E = window.GeometryEngine;
  if (!E?.Renderer) return;

  const R = E.Renderer.prototype;
  const baseRender = R.render;

  R.render = function renderWithShapeBlueprint(level, user, preview, physics) {
    baseRender.call(this, level, user, preview, physics);

    if (level?.phase !== 'gravity' || !Array.isArray(level.blueprint) || physics) return;

    const equations = level.blueprint
      .map((formula) => {
        try { return E.parseEquation(formula); } catch { return null; }
      })
      .filter(Boolean);

    const ctx = this.ctx;
    equations.forEach((eq) => this.equation(eq, 'rgba(79, 201, 191, .22)', 5, [11, 8]));

    ctx.save();
    ctx.fillStyle = '#6E817D';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Shape blueprint · build this with equations', 18, 26);
    ctx.restore();
  };
})();
