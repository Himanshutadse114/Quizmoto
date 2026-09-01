(() => {
  'use strict';
  const level = window.GeometryGameData?.levels?.find((item) => item.id === 28);
  if (!level) return;
  level.solution = ['x^2 + (y-1.5)^2 = 4'];
  level.budget = 1;
  level.hint = 'Use a radius-2 circle centred at (0,1.5): x^2 + (y-1.5)^2 = 4. The falling ball strikes the circle and is redirected through the star path.';
})();
