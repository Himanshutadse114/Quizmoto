(() => {
  'use strict';

  const data = window.GeometryGameData;
  if (!data?.levels) return;

  const variedRampLevels = [
    {
      id: 37, phase: 'gravity', title: 'Absolute V-Valley', family: 'Absolute Value',
      description: 'Build a V-shaped valley with one absolute-value equation. Gravity pulls the ball into the vertex and momentum carries it up the other side.',
      solution: ['y = 0.7*abs(x) - 2; [-5.5, 5]'], budget: 1,
      hint: 'Use the absolute-value form y = a|x-h| + k. For this centred V, try y = 0.7*abs(x) - 2.',
      spawn: { x: -5.3, y: 2.6 }, basket: { x: 4.2, y: 1.0 },
      stars: [{ x: -3, y: 0.1 }, { x: 0, y: -2 }, { x: 2.5, y: -0.25 }],
      gravity: 9.81, initialVx: 2.5, initialVy: 0, timeLimit: 18,
      blueprint: ['y = 0.7*abs(x) - 2; [-5.5, 5]']
    },
    {
      id: 38, phase: 'gravity', title: 'Absolute Roof Ridge', family: 'Absolute Value',
      description: 'Create an inverted V using one transformed absolute-value function. The ball must climb the roof, cross the ridge and descend.',
      solution: ['y = -0.3*abs(x) + 1.5; [-5, 5]'], budget: 1,
      hint: 'A negative coefficient flips the V upside down. Try y = -0.3*abs(x) + 1.5.',
      spawn: { x: -5.2, y: 0.4 }, basket: { x: 4.7, y: 0.2 },
      stars: [{ x: -3, y: 0.6 }, { x: 0, y: 1.5 }, { x: 3, y: 0.6 }],
      gravity: 9.81, initialVx: 7.0, initialVy: 0, timeLimit: 13,
      blueprint: ['y = -0.3*abs(x) + 1.5; [-5, 5]']
    },
    {
      id: 39, phase: 'gravity', title: 'Triangle Traverse', family: 'Polygon Lines',
      description: 'Build a complete triangle from three bounded straight lines. Use domains to make the edges meet exactly at the vertices.',
      solution: ['y = 0.5*x + 1; [-4, 0]', 'y = -0.5*x + 1; [0, 4]', 'y = -1; [-4, 4]'], budget: 3,
      hint: 'Use one rising side, one falling side and one horizontal base. Every line needs a domain so it stops at the correct corner.',
      spawn: { x: -4.4, y: -0.7 }, basket: { x: 3.5, y: -0.8 },
      stars: [{ x: -2.5, y: -0.15 }, { x: 0, y: 1.1 }, { x: 2.6, y: -0.2 }],
      gravity: 9.81, initialVx: 8, initialVy: 0, timeLimit: 15,
      blueprint: ['y = 0.5*x + 1; [-4, 0]', 'y = -0.5*x + 1; [0, 4]', 'y = -1; [-4, 4]']
    },
    {
      id: 40, phase: 'gravity', title: 'Trapezium Bridge', family: 'Polygon Lines',
      description: 'Create a trapezium-style bridge with sloped connectors and a horizontal deck. Practise slope, intercept and domains together.',
      solution: ['y = 0.5*x + 3; [-6, -4]', 'y = 1; [-4, 1]', 'y = -0.67*x + 1.67; [1, 4]'], budget: 3,
      hint: 'Build an upward connector, a flat top and a descending connector. Use domains so the three pieces meet at the corners.',
      spawn: { x: -5.8, y: 0.4 }, basket: { x: 3.6, y: -0.8 },
      stars: [{ x: -4.5, y: 0.75 }, { x: -1, y: 1.2 }, { x: 2.5, y: 0 }],
      gravity: 9.81, initialVx: 5, initialVy: 0, timeLimit: 13,
      blueprint: ['y = 0.5*x + 3; [-6, -4]', 'y = 1; [-4, 1]', 'y = -0.67*x + 1.67; [1, 4]']
    },
    {
      id: 41, phase: 'gravity', title: 'Parabola Bowl', family: 'Quadratic Functions',
      description: 'Replace three line segments with one smooth quadratic bowl. Observe how a continuously changing slope changes the ball motion.',
      solution: ['y = 0.18*x^2 - 2; [-5, 5]'], budget: 1,
      hint: 'Use y = ax^2 + c with a positive a to open upward. Try y = 0.18*x^2 - 2.',
      spawn: { x: -5.0, y: 3.0 }, basket: { x: 4.0, y: 1.0 },
      stars: [{ x: -3, y: -0.38 }, { x: 0, y: -2 }, { x: 2, y: -1.28 }],
      gravity: 9.81, initialVx: 2.6, initialVy: 0, timeLimit: 18,
      blueprint: ['y = 0.18*x^2 - 2; [-5, 5]']
    },
    {
      id: 42, phase: 'gravity', title: 'Staircase Drop', family: 'Piecewise Lines',
      description: 'Construct four horizontal platforms. The ball must leave each domain, fall freely and land on the next step.',
      solution: ['y = 3; [-6, -3.8]', 'y = 1.5; [-3.2, -1]', 'y = 0; [-0.4, 1.8]', 'y = -1.5; [2.4, 4.8]'], budget: 4,
      hint: 'A staircase uses several y = constant equations. The domain gaps create the free-fall sections between steps.',
      spawn: { x: -5.8, y: 3.5 }, basket: { x: 4.0, y: -1.3 },
      stars: [{ x: -4.5, y: 3.2 }, { x: -2, y: 1.7 }, { x: 0.7, y: 0.2 }],
      gravity: 9.81, initialVx: 2.0, initialVy: 0, timeLimit: 20,
      blueprint: ['y = 3; [-6, -3.8]', 'y = 1.5; [-3.2, -1]', 'y = 0; [-0.4, 1.8]', 'y = -1.5; [2.4, 4.8]']
    },
    {
      id: 43, phase: 'gravity', title: 'Sine Roller', family: 'Trigonometry',
      description: 'Build rolling terrain from a sine wave plus a gentle downhill trend. Watch the ball accelerate and slow across crests and troughs.',
      solution: ['y = 0.45*sin(1.2*x) - 0.38*x + 0.2; [-6, 5.5]'], budget: 1,
      hint: 'The sine term creates the wave and the linear term keeps the whole track trending downhill. Try 0.45*sin(1.2*x) - 0.38*x + 0.2.',
      spawn: { x: -5.8, y: 3.1 }, basket: { x: 5.0, y: -1.7 },
      stars: [{ x: -4, y: 1.96 }, { x: 0, y: 0.2 }, { x: 3, y: -1.14 }],
      gravity: 9.81, initialVx: 2.6, initialVy: 0, timeLimit: 18,
      blueprint: ['y = 0.45*sin(1.2*x) - 0.38*x + 0.2; [-6, 5.5]']
    },
    {
      id: 44, phase: 'gravity', title: 'Semicircle Halfpipe', family: 'Circular Arcs',
      description: 'Use a lower semicircle as a true halfpipe. The square-root formula creates the curved bowl the ball rolls through.',
      solution: ['y = -sqrt(16 - x^2); [-4, 4]'], budget: 1,
      hint: 'Solve x^2 + y^2 = 16 for the lower half: y = -sqrt(16 - x^2).',
      spawn: { x: -4.1, y: 1.5 }, basket: { x: 3.6, y: -1.7 },
      stars: [{ x: -2.5, y: -3.12 }, { x: 0, y: -4 }, { x: 2.5, y: -3.12 }],
      gravity: 9.81, initialVx: 4.5, initialVy: 0, timeLimit: 18,
      blueprint: ['y = -sqrt(16 - x^2); [-4, 4]']
    },
    {
      id: 45, phase: 'gravity', title: 'Shifted Arc Bowl', family: 'Circular Arcs',
      description: 'Move the semicircle away from the origin. This challenge teaches horizontal and vertical shifts inside a square-root arc.',
      solution: ['y = 0.5 - sqrt(12.25 - (x+0.5)^2); [-4, 3]'], budget: 1,
      hint: 'Use y = k - sqrt(r^2 - (x-h)^2). Here the centre is shifted left by 0.5 and up by 0.5.',
      spawn: { x: -4.1, y: 2.0 }, basket: { x: 2.8, y: -0.7 },
      stars: [{ x: -2.5, y: -2.37 }, { x: -0.5, y: -3.0 }, { x: 2.0, y: -1.95 }],
      gravity: 9.81, initialVx: 4.6, initialVy: 0, timeLimit: 18,
      blueprint: ['y = 0.5 - sqrt(12.25 - (x+0.5)^2); [-4, 3]']
    },
    {
      id: 46, phase: 'gravity', title: 'Square-Root Chute', family: 'Square Root Functions',
      description: 'Create a one-sided curved chute with a square-root function. Notice how the ramp begins at a fixed endpoint and gradually flattens.',
      solution: ['y = -1.05*sqrt(x+6) + 3.8; [-6, 5.5]'], budget: 1,
      hint: 'A square-root path starts where the expression inside sqrt becomes zero. Try y = -1.05*sqrt(x+6) + 3.8.',
      spawn: { x: -5.8, y: 4.5 }, basket: { x: 5.0, y: 0.3 },
      stars: [{ x: -4, y: 2.31 }, { x: 0, y: 1.23 }, { x: 3, y: 0.65 }],
      gravity: 9.81, initialVx: 1.6, initialVy: 0, timeLimit: 18,
      blueprint: ['y = -1.05*sqrt(x+6) + 3.8; [-6, 5.5]']
    },
    {
      id: 47, phase: 'gravity', title: 'Cubic S-Chute', family: 'Cubic Functions',
      description: 'Use a cubic to create a smooth S-shaped descent. The changing curvature is different from both a line and a parabola.',
      solution: ['y = -0.012*(x+1)^3 - 0.45*x + 1; [-6, 4.5]'], budget: 1,
      hint: 'A small cubic coefficient keeps the S-curve controllable. Try y = -0.012*(x+1)^3 - 0.45*x + 1.',
      spawn: { x: -5.8, y: 5.8 }, basket: { x: 4.0, y: -2.3 },
      stars: [{ x: -4, y: 3.12 }, { x: -1, y: 1.45 }, { x: 2, y: -0.22 }],
      gravity: 9.81, initialVx: 1.7, initialVy: 0, timeLimit: 18,
      blueprint: ['y = -0.012*(x+1)^3 - 0.45*x + 1; [-6, 4.5]']
    },
    {
      id: 48, phase: 'gravity', title: 'Exponential Decay Ramp', family: 'Exponential Functions',
      description: 'Build a ramp whose steepness changes exponentially. The beginning falls quickly and the track gradually becomes flatter.',
      solution: ['y = 4.5*(0.8^(x+6)) - 1.5; [-6, 5.5]'], budget: 1,
      hint: 'Use a base between 0 and 1 for exponential decay. Try y = 4.5*(0.8^(x+6)) - 1.5.',
      spawn: { x: -5.8, y: 4.0 }, basket: { x: 5.0, y: -1.1 },
      stars: [{ x: -4, y: 1.38 }, { x: 0, y: -0.32 }, { x: 3, y: -0.90 }],
      gravity: 9.81, initialVx: 3.5, initialVy: 0, timeLimit: 18,
      blueprint: ['y = 4.5*(0.8^(x+6)) - 1.5; [-6, 5.5]']
    },
    {
      id: 49, phase: 'gravity', title: 'Reciprocal Curve', family: 'Rational Functions',
      description: 'Use a reciprocal term to create a ramp whose curvature is strongest near one side and gradually settles into a long descent.',
      solution: ['y = 1/(x+7) - 0.4*x; [-6, 5.5]'], budget: 1,
      hint: 'Combine a reciprocal with a linear trend: y = 1/(x+7) - 0.4*x. The x+7 keeps the vertical asymptote outside the playable domain.',
      spawn: { x: -5.8, y: 4.4 }, basket: { x: 5.0, y: -1.9 },
      stars: [{ x: -4, y: 1.93 }, { x: 0, y: 0.14 }, { x: 3, y: -1.10 }],
      gravity: 9.81, initialVx: 2.3, initialVy: 0, timeLimit: 18,
      blueprint: ['y = 1/(x+7) - 0.4*x; [-6, 5.5]']
    },
    {
      id: 50, phase: 'gravity', title: 'Mixed Formula Circuit', family: 'Mixed Functions',
      description: 'Final challenge: connect three different formula families into one physical course — a quadratic, a sine section and a square-root finish.',
      solution: [
        'y = 0.05*x^2 - 0.65*x - 0.2; [-6, -1]',
        'y = 0.35*sin(1.2*x) - 0.35*x + 0.15; [-1, 2.5]',
        'y = -0.8*sqrt(x-2.5) - 0.65; [2.5, 5.5]'
      ], budget: 3,
      hint: 'Solve the route in three sections. Use a quadratic for the opening descent, sine for the middle terrain and a square-root chute for the finish.',
      spawn: { x: -5.8, y: 6.0 }, basket: { x: 5.2, y: -2.0 },
      stars: [{ x: -4, y: 3.20 }, { x: 0, y: 0.15 }, { x: 4, y: -1.63 }],
      gravity: 9.81, initialVx: 1.7, initialVy: 0, timeLimit: 22,
      blueprint: [
        'y = 0.05*x^2 - 0.65*x - 0.2; [-6, -1]',
        'y = 0.35*sin(1.2*x) - 0.35*x + 0.15; [-1, 2.5]',
        'y = -0.8*sqrt(x-2.5) - 0.65; [2.5, 5.5]'
      ]
    }
  ];

  const replacedIds = new Set(variedRampLevels.map((level) => level.id));
  data.levels = data.levels.filter((level) => !replacedIds.has(level.id));
  data.levels.push(...variedRampLevels);
})();
