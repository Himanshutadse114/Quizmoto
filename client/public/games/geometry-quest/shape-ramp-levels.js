(() => {
  'use strict';

  const data = window.GeometryGameData;
  if (!data?.levels) return;

  const shapeRampLevels = [
    {
      id: 37, phase: 'gravity', title: 'V-Valley Ramp', family: 'Linear Shape Ramps',
      description: 'Build two bounded lines that meet in a V. Let gravity pull the ball into the valley, then use its momentum to climb the other side.',
      solution: ['y = -0.8*x; [-6, 0]', 'y = 0.8*x; [0, 5]'], budget: 2,
      hint: 'A V uses opposite slopes. Try y = -0.8*x on the left and y = 0.8*x on the right, with domains that meet at x = 0.',
      spawn: { x: -5.7, y: 5.5 }, basket: { x: 4, y: 3.2 },
      stars: [{ x: -4, y: 3.2 }, { x: -1, y: 0.8 }, { x: 2, y: 1.6 }],
      gravity: 9.81, initialVx: 1.2, initialVy: 0, timeLimit: 20,
      blueprint: ['y = -0.8*x; [-6, 0]', 'y = 0.8*x; [0, 5]']
    },
    {
      id: 38, phase: 'gravity', title: 'Roof Ridge', family: 'Linear Shape Ramps',
      description: 'Construct an inverted V like a roof. Give the ball enough momentum to climb the first side, cross the ridge and descend the second.',
      solution: ['y = 0.3*x + 1.5; [-5, 0]', 'y = -0.3*x + 1.5; [0, 5.5]'], budget: 2,
      hint: 'A symmetric roof uses equal and opposite slopes. Use +0.3 on the left and -0.3 on the right so both lines meet at the ridge.',
      spawn: { x: -5.3, y: 0.2 }, basket: { x: 5, y: 0 },
      stars: [{ x: -3, y: 0.7 }, { x: 0, y: 1.6 }, { x: 3, y: 0.7 }],
      gravity: 9.81, initialVx: 7, initialVy: 0, timeLimit: 12,
      blueprint: ['y = 0.3*x + 1.5; [-5, 0]', 'y = -0.3*x + 1.5; [0, 5.5]']
    },
    {
      id: 39, phase: 'gravity', title: 'Triangle Traverse', family: 'Polygon Shape Ramps',
      description: 'Build a complete triangle from three bounded lines. The ball must climb one side, cross the apex, descend the other and finish near the base.',
      solution: ['y = 0.5*x + 1; [-4, 0]', 'y = -0.5*x + 1; [0, 4]', 'y = -1; [-4, 4]'], budget: 3,
      hint: 'Use two opposite slopes for the sides and one horizontal line for the base. Restrict every edge so the three lines form a closed triangle.',
      spawn: { x: -4.4, y: -0.7 }, basket: { x: 3.5, y: -0.8 },
      stars: [{ x: -2.5, y: -0.15 }, { x: 0, y: 1.1 }, { x: 2.6, y: -0.2 }],
      gravity: 9.81, initialVx: 8, initialVy: 0, timeLimit: 15,
      blueprint: ['y = 0.5*x + 1; [-4, 0]', 'y = -0.5*x + 1; [0, 4]', 'y = -1; [-4, 4]']
    },
    {
      id: 40, phase: 'gravity', title: 'Trapezium Bridge', family: 'Polygon Shape Ramps',
      description: 'Create a trapezium-style bridge: rise onto a flat deck, travel across it and descend through the final side.',
      solution: ['y = 0.5*x + 3; [-6, -4]', 'y = 1; [-4, 1]', 'y = -0.67*x + 1.67; [1, 4]'], budget: 3,
      hint: 'Think of three pieces: an upward connector, a horizontal top and a descending connector. Domains make the pieces meet at the corners.',
      spawn: { x: -5.8, y: 0.4 }, basket: { x: 3.6, y: -0.8 },
      stars: [{ x: -4.5, y: 0.75 }, { x: -1, y: 1.2 }, { x: 2.5, y: 0 }],
      gravity: 9.81, initialVx: 5, initialVy: 0, timeLimit: 12,
      blueprint: ['y = 0.5*x + 3; [-6, -4]', 'y = 1; [-4, 1]', 'y = -0.67*x + 1.67; [1, 4]']
    },
    {
      id: 41, phase: 'gravity', title: 'U-Channel', family: 'Polygon Shape Ramps',
      description: 'Build a polygonal U-shaped channel with two sloped walls and a flat floor. Momentum must carry the ball back up the exit side.',
      solution: ['y = -x - 3; [-6, -3]', 'y = 0; [-3, 1]', 'y = 0.67*x - 0.67; [1, 4]'], budget: 3,
      hint: 'Make a descending left wall, a horizontal floor and an ascending right wall. The domains should meet cleanly at the two bottom corners.',
      spawn: { x: -5.8, y: 3.4 }, basket: { x: 3.7, y: 1.8 },
      stars: [{ x: -4, y: 1 }, { x: 0, y: 0.2 }, { x: 2.5, y: 1 }],
      gravity: 9.81, initialVx: 3, initialVy: 0, timeLimit: 12,
      blueprint: ['y = -x - 3; [-6, -3]', 'y = 0; [-3, 1]', 'y = 0.67*x - 0.67; [1, 4]']
    },
    {
      id: 42, phase: 'gravity', title: 'Staircase Drop', family: 'Piecewise Shape Ramps',
      description: 'Construct four separate horizontal steps. The ball must leave each platform, fall under gravity and land on the next lower step.',
      solution: ['y = 3; [-6, -3.8]', 'y = 1.5; [-3.2, -1]', 'y = 0; [-0.4, 1.8]', 'y = -1.5; [2.4, 4.8]'], budget: 4,
      hint: 'A staircase is a set of horizontal equations at different y-values. Leave controlled gaps between their domains so gravity creates each drop.',
      spawn: { x: -5.8, y: 3.5 }, basket: { x: 4, y: -1.3 },
      stars: [{ x: -4.5, y: 3.2 }, { x: -2, y: 1.7 }, { x: 0.7, y: 0.2 }],
      gravity: 9.81, initialVx: 2, initialVy: 0, timeLimit: 20,
      blueprint: ['y = 3; [-6, -3.8]', 'y = 1.5; [-3.2, -1]', 'y = 0; [-0.4, 1.8]', 'y = -1.5; [2.4, 4.8]']
    },
    {
      id: 43, phase: 'gravity', title: 'W-Ramp', family: 'Linear Shape Ramps',
      description: 'Build a six-segment W-style track. The ball must survive repeated changes between descending and rising line segments.',
      solution: ['y = -0.75*x - 2.5; [-6, -4]', 'y = 0.25*x + 1.5; [-4, -2]', 'y = -0.75*x - 0.5; [-2, 0]', 'y = 0.25*x - 0.5; [0, 2]', 'y = -0.75*x + 1.5; [2, 4]', 'y = 0.33*x - 2.83; [4, 5.5]'], budget: 6,
      hint: 'A W is a sequence of alternating negative and positive slopes. Keep the upward segments shallower so the ball has enough momentum to cross them.',
      spawn: { x: -5.8, y: 2.4 }, basket: { x: 5.18, y: -0.895 },
      stars: [{ x: -3.74, y: 2.07 }, { x: 0.18, y: -0.24 }, { x: 4.04, y: -0.095 }],
      gravity: 9.81, initialVx: 8, initialVy: 0, timeLimit: 12,
      blueprint: ['y = -0.75*x - 2.5; [-6, -4]', 'y = 0.25*x + 1.5; [-4, -2]', 'y = -0.75*x - 0.5; [-2, 0]', 'y = 0.25*x - 0.5; [0, 2]', 'y = -0.75*x + 1.5; [2, 4]', 'y = 0.33*x - 2.83; [4, 5.5]']
    },
    {
      id: 44, phase: 'gravity', title: 'Diamond Run', family: 'Polygon Shape Ramps',
      description: 'Construct a complete diamond with four bounded lines. The ball travels over the upper two edges while the lower pair completes the shape.',
      solution: ['y = 0.4*x + 1.6; [-4, 0]', 'y = -0.4*x + 1.6; [0, 4]', 'y = -0.4*x - 1.6; [-4, 0]', 'y = 0.4*x - 1.6; [0, 4]'], budget: 4,
      hint: 'All four diamond edges use the same slope magnitude. Alternate +0.4 and -0.4 and choose intercepts that create matching top and bottom vertices.',
      spawn: { x: -4.2, y: 0.2 }, basket: { x: 3.7, y: 0.2 },
      stars: [{ x: -2, y: 0.8 }, { x: 0, y: 1.8 }, { x: 2, y: 0.8 }],
      gravity: 9.81, initialVx: 6, initialVy: 0, timeLimit: 12,
      blueprint: ['y = 0.4*x + 1.6; [-4, 0]', 'y = -0.4*x + 1.6; [0, 4]', 'y = -0.4*x - 1.6; [-4, 0]', 'y = 0.4*x - 1.6; [0, 4]']
    },
    {
      id: 45, phase: 'gravity', title: 'Multi-Deck Bridge', family: 'Piecewise Shape Ramps',
      description: 'Combine sloped connectors and flat decks into a long bridge. The ball must transfer cleanly between five separate line segments.',
      solution: ['y = -0.5*x; [-6, -4]', 'y = 2; [-4, -1]', 'y = -x + 1; [-1, 1]', 'y = 0; [1, 4]', 'y = -x + 4; [4, 5.5]'], budget: 5,
      hint: 'Alternate between a connector and a deck. Horizontal lines create stable platforms; negative slopes move the ball to the next lower level.',
      spawn: { x: -5.8, y: 3.4 }, basket: { x: 5.33, y: -0.07 },
      stars: [{ x: -4.14, y: 2.29 }, { x: -0.23, y: 2.15 }, { x: 4.07, y: 0.26 }],
      gravity: 9.81, initialVx: 2, initialVy: 0, timeLimit: 12,
      blueprint: ['y = -0.5*x; [-6, -4]', 'y = 2; [-4, -1]', 'y = -x + 1; [-1, 1]', 'y = 0; [1, 4]', 'y = -x + 4; [4, 5.5]']
    },
    {
      id: 46, phase: 'gravity', title: 'Sloped Staircase', family: 'Piecewise Shape Ramps',
      description: 'Build three separated diagonal steps. Each segment has the same slope but a different intercept, teaching how c shifts a line without changing its angle.',
      solution: ['y = -0.3*x + 1; [-6, -3]', 'y = -0.3*x; [-2.5, 0.5]', 'y = -0.3*x - 1; [1, 4.5]'], budget: 3,
      hint: 'Keep the slope at -0.3 for every step. Change only the intercept and domain to move each parallel ramp lower and farther right.',
      spawn: { x: -5.8, y: 3.2 }, basket: { x: 4, y: -2 },
      stars: [{ x: -4.5, y: 2.55 }, { x: -1, y: 0.3 }, { x: 2.5, y: -1.75 }],
      gravity: 9.81, initialVx: 2, initialVy: 0, timeLimit: 20,
      blueprint: ['y = -0.3*x + 1; [-6, -3]', 'y = -0.3*x; [-2.5, 0.5]', 'y = -0.3*x - 1; [1, 4.5]']
    },
    {
      id: 47, phase: 'gravity', title: 'Pentagon Ridge', family: 'Polygon Shape Ramps',
      description: 'Construct a five-sided polygon. The ball must climb the upper-left edge, cross the flat top and descend the upper-right edge.',
      solution: ['y = x + 4; [-4, -2]', 'y = 2; [-2, 2]', 'y = -x + 4; [2, 4]', 'y = 0.5*x - 2; [0, 4]', 'y = -0.5*x - 2; [-4, 0]'], budget: 5,
      hint: 'Build the pentagon as a flat top, two upper diagonal edges and two lower diagonal edges. The upper slopes are steeper than the lower pair.',
      spawn: { x: -4.2, y: 0.2 }, basket: { x: 3.7, y: 0.2 },
      stars: [{ x: -3, y: 1 }, { x: 0, y: 2.2 }, { x: 3, y: 1 }],
      gravity: 9.81, initialVx: 10, initialVy: 0, timeLimit: 12,
      blueprint: ['y = x + 4; [-4, -2]', 'y = 2; [-2, 2]', 'y = -x + 4; [2, 4]', 'y = 0.5*x - 2; [0, 4]', 'y = -0.5*x - 2; [-4, 0]']
    },
    {
      id: 48, phase: 'gravity', title: 'Hexagon Ridge', family: 'Polygon Shape Ramps',
      description: 'Build a complete six-sided hexagon from bounded lines and guide the ball across its upper three edges.',
      solution: ['y = 0.75*x + 3; [-4, -2]', 'y = 1.5; [-2, 2]', 'y = -0.75*x + 3; [2, 4]', 'y = 0.75*x - 3; [2, 4]', 'y = -1.5; [-2, 2]', 'y = -0.75*x - 3; [-4, -2]'], budget: 6,
      hint: 'A horizontal hexagon has flat top and bottom edges plus four matching diagonal sides. Use symmetric domains on the left and right.',
      spawn: { x: -4.2, y: 0.2 }, basket: { x: 3.7, y: 0.2 },
      stars: [{ x: -3, y: 0.75 }, { x: 0, y: 1.7 }, { x: 3, y: 0.75 }],
      gravity: 9.81, initialVx: 8, initialVy: 0, timeLimit: 12,
      blueprint: ['y = 0.75*x + 3; [-4, -2]', 'y = 1.5; [-2, 2]', 'y = -0.75*x + 3; [2, 4]', 'y = 0.75*x - 3; [2, 4]', 'y = -1.5; [-2, 2]', 'y = -0.75*x - 3; [-4, -2]']
    },
    {
      id: 49, phase: 'gravity', title: 'Sawtooth Descent', family: 'Linear Shape Ramps',
      description: 'Create a seven-segment sawtooth path with repeated drops and short recovery slopes. Each corner changes the ball’s direction.',
      solution: ['y = -x - 3; [-6, -4]', 'y = 0.3*x + 2.2; [-4, -3]', 'y = -0.9*x - 1.4; [-3, -1]', 'y = 0.3*x - 0.2; [-1, 0]', 'y = -0.9*x - 0.2; [0, 2]', 'y = 0.3*x - 2.6; [2, 3]', 'y = -0.65*x + 0.25; [3, 5]'], budget: 7,
      hint: 'Sawteeth alternate steep negative slopes with short shallow positive slopes. The overall path still needs to trend downward.',
      spawn: { x: -5.8, y: 3.4 }, basket: { x: 4.58, y: 0.18 },
      stars: [{ x: -4.1, y: 2.82 }, { x: -1.41, y: 0.14 }, { x: 2.32, y: 0.44 }],
      gravity: 9.81, initialVx: 5, initialVy: 0, timeLimit: 12,
      blueprint: ['y = -x - 3; [-6, -4]', 'y = 0.3*x + 2.2; [-4, -3]', 'y = -0.9*x - 1.4; [-3, -1]', 'y = 0.3*x - 0.2; [-1, 0]', 'y = -0.9*x - 0.2; [0, 2]', 'y = 0.3*x - 2.6; [2, 3]', 'y = -0.65*x + 0.25; [3, 5]']
    },
    {
      id: 50, phase: 'gravity', title: 'Shape Master Circuit', family: 'Mixed Polygon Ramps',
      description: 'Final line-shape challenge: combine seven bounded segments into a long polygonal circuit with slopes, decks, corners and controlled drops.',
      solution: ['y = -0.75*x - 1; [-6, -4]', 'y = 2; [-4, -2]', 'y = -0.75*x + 0.5; [-2, 0]', 'y = 0.5; [0, 1.5]', 'y = -x + 2; [1.5, 3]', 'y = -1; [3, 4.5]', 'y = -x + 3.5; [4.5, 5.5]'], budget: 7,
      hint: 'Solve the circuit one section at a time. Identify whether each part is a horizontal deck or a descending connector, then use domains to join them.',
      spawn: { x: -5.8, y: 3.9 }, basket: { x: 5.14, y: -1.07 },
      stars: [{ x: -4.3, y: 2.47 }, { x: 1.14, y: 0.9 }, { x: 3.66, y: 0.12 }],
      gravity: 9.81, initialVx: 2, initialVy: 0, timeLimit: 12,
      blueprint: ['y = -0.75*x - 1; [-6, -4]', 'y = 2; [-4, -2]', 'y = -0.75*x + 0.5; [-2, 0]', 'y = 0.5; [0, 1.5]', 'y = -x + 2; [1.5, 3]', 'y = -1; [3, 4.5]', 'y = -x + 3.5; [4.5, 5.5]']
    }
  ];

  const existingIds = new Set(data.levels.map((level) => level.id));
  for (const level of shapeRampLevels) {
    if (!existingIds.has(level.id)) data.levels.push(level);
  }
})();
