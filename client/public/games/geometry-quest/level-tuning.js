(() => {
  'use strict';

  const levels = window.GeometryGameData?.levels;
  if (!levels) return;

  // Retuned for the natural-gravity engine. The ball now gains speed from
  // gravity itself rather than from an artificial acceleration boost.
  const halfpipe = levels.find((item) => item.id === 26);
  if (halfpipe) {
    halfpipe.spawn = { x: -4.2, y: 2.2 };
    halfpipe.basket = { x: 3.1, y: -2.6 };
    halfpipe.stars = [
      { x: -2.6, y: -2.4 },
      { x: 0, y: -3.7 },
      { x: 2.4, y: -3.0 },
    ];
    halfpipe.solution = ['-sqrt(16 - x^2); [-4, 4]'];
    halfpipe.budget = 1;
    halfpipe.initialVx = 1.5;
    halfpipe.initialVy = 0;
    halfpipe.gravity = 9.2;
    halfpipe.timeLimit = 12;
    halfpipe.hint = 'Use the lower half of a radius-4 circle: y = -sqrt(16 - x^2); [-4, 4]. Gravity pulls the ball into the bowl and its momentum carries it up the far side.';
  }

  // Circle bumper tuning retained because it behaves correctly with the more
  // physical collision response.
  const bumper = levels.find((item) => item.id === 28);
  if (bumper) {
    bumper.solution = ['x^2 + (y-1.5)^2 = 4'];
    bumper.budget = 1;
    bumper.hint = 'Use a radius-2 circle centred at (0,1.5): x^2 + (y-1.5)^2 = 4. The falling ball strikes the circle and is redirected through the star path.';
  }
})();