(() => {
  'use strict';

  const { levels, phases } = window.GeometryGameData;
  const E = window.GeometryEngine;
  const $ = (s) => document.querySelector(s);
  const STORAGE_KEY = 'quizmoto.geometry.physics.v2';

  let saved = loadSaved();
  let currentIndex = clamp(saved.lastIndex || 0, 0, levels.length - 1);
  let userSurfaces = [];
  let preview = null;
  let physics = null;
  let raf = 0;
  let lastTs = 0;
  let accumulator = 0;
  let hintUsed = false;
  let attempts = 0;
  let starBeepIndex = 0;
  const renderer = new E.Renderer($('#gameCanvas'));

  const SHAPE_LESSONS = {
    1: lesson('Horizontal lines', 'A horizontal line never rises or falls. Its y-value stays constant while x can change.', 'y = c',
      ['The constant c tells you the height of the line.', 'Changing c moves the whole line up or down without changing its direction.', 'A domain such as ; [-5, 5] lets you show only the part of the line you need.'],
      'For y = 2, every point on the line has y-coordinate 2, such as (-3,2), (0,2) and (4,2).',
      'Keep one y-value fixed across the required x-range.'),
    2: lesson('Vertical lines', 'A vertical line keeps x fixed while y changes. It cannot be written in the usual y = mx + c form.', 'x = c',
      ['The constant c fixes the horizontal position.', 'x = 2 means every point has x-coordinate 2.', 'For a bounded vertical segment, the domain controls the y-range instead of the x-range.'],
      'x = -1 draws a vertical line through every point whose x-coordinate is -1.',
      'Fix x instead of y when the target is vertical.'),
    3: lesson('Parallel lines', 'Parallel straight lines point in exactly the same direction, so they share the same slope.', 'y = mx + c',
      ['m is the slope and controls direction or steepness.', 'Parallel lines use the same m but different values of c.', 'Domains can trim both lines to the same visible length.'],
      'y = x and y = x + 2 both have slope 1, so they stay the same distance apart.',
      'Match the slope first, then change only the intercept.'),
    4: lesson('Opposite slopes', 'Two diagonal lines can form an X when one rises at the same rate that the other falls.', 'y = mx  and  y = -mx',
      ['Positive slope rises from left to right.', 'Negative slope falls from left to right.', 'Equal slope magnitudes make the X symmetric around the origin.'],
      'y = x and y = -x meet at (0,0) and form a symmetric X.',
      'Use equal-size positive and negative slopes.'),
    5: lesson('Building with domains', 'A complex shape is often made from several simple equations, each shown only where it is needed.', 'y = mx + c ; [min, max]',
      ['The formula decides the line itself.', 'The domain decides where that line starts and stops.', 'Two bounded segments can meet at one point to create a corner.'],
      'y = x + 3 ; [-3, 0] shows only the left half of that line, ending exactly at x = 0.',
      'Think of a domain as cutting a long line into a useful segment.'),
    6: lesson('Triangles from three lines', 'A triangle is a piecewise construction: one bounded base and two bounded sloping sides.', '3 bounded line equations',
      ['Start with the horizontal base.', 'Use one rising and one falling side so they meet at the top vertex.', 'Restrict each side with a domain so no line continues outside the triangle.'],
      'A base can use y = -2 while the two sides use positive and negative slopes that meet above it.',
      'Build one edge at a time and make the endpoints meet.'),
    7: lesson('Axis-aligned squares', 'A square centred on the axes combines two horizontal and two vertical segments.', 'y = ±a  and  x = ±a',
      ['Opposite sides are parallel.', 'All four sides use the same distance from the centre for a true square.', 'Domains stop each side exactly at the corners.'],
      'For a square extending 2 units from the origin, its boundaries are x = ±2 and y = ±2.',
      'Use matching positive and negative boundaries.'),
    8: lesson('Rectangles', 'A rectangle uses the same four boundary ideas as a square, but width and height can be different.', 'y = ±h  and  x = ±w',
      ['Horizontal sides control the top and bottom.', 'Vertical sides control the left and right.', 'Use domains to stop every edge at a corner.'],
      'A wide rectangle might use x = ±3 for its sides and y = ±1 for its top and bottom.',
      'Choose horizontal and vertical extents independently.'),
    9: lesson('Diamonds and slope', 'A diamond is made from four line segments with alternating positive and negative slopes.', 'y = ±mx ± c',
      ['Each edge is still just a straight line.', 'Symmetry comes from reusing equal slope magnitudes.', 'Domains divide the four equations into separate edges.'],
      'With slope magnitudes of 1, y = x + 3 and y = -x + 3 can form the upper half of a diamond.',
      'Mirror the upper pair to create the lower pair.'),
    10: lesson('Trapeziums', 'A trapezium needs one pair of parallel sides. The other two sides can be sloped connectors.', 'parallel bases + 2 connectors',
      ['Use two horizontal constants for the parallel bases.', 'Give the shorter and longer bases different domains.', 'Use sloped lines to connect corresponding endpoints.'],
      'A lower base can be wider than an upper base while both remain horizontal and parallel.',
      'Build the parallel pair first, then connect the ends.'),
    11: lesson('Circle equation', 'A circle is defined by all points that stay the same distance r from one centre.', 'x² + y² = r²',
      ['r is the radius.', 'The right side is r squared, not r.', 'This form is centred at the origin (0,0).'],
      'If r = 3, then r² = 9, giving x² + y² = 9.',
      'Find the radius first, then square it.'),
    12: lesson('Shifted circles', 'To move a circle away from the origin, put its centre coordinates inside the squared brackets.', '(x-h)² + (y-k)² = r²',
      ['(h,k) is the centre.', 'The signs inside the brackets are opposite the centre coordinates.', 'r still controls the radius.'],
      'A circle centred at (2,1) with radius 2 uses (x-2)² + (y-1)² = 4.',
      'Read h, k and r separately before writing the equation.'),
    13: lesson('Multiple circles', 'You can build a larger picture by adding several circle equations with different centres.', '(x-h)² + (y-k)² = r²',
      ['Each circle is a separate equation.', 'Keep the radius the same when the circles need equal size.', 'Change h and k to move each circle independently.'],
      'Two radius-1 circles can be placed side by side by changing only their h values.',
      'Treat every circle as its own object.'),
    14: lesson('Parabolas', 'A quadratic graph bends because x is squared. The sign and size of the x² coefficient control the bowl.', 'y = ax² + bx + c',
      ['Positive a opens upward; negative a opens downward.', 'Larger |a| makes the curve narrower and steeper.', 'c moves the graph vertically when b = 0.'],
      'y = 0.5x² - 2 opens upward and has its lowest point below the x-axis.',
      'Start with the opening direction, then tune width and height.'),
    15: lesson('Semicircles', 'A semicircle can be written by solving the circle equation for y and choosing either the positive or negative square root.', 'y = k ± √(r² - (x-h)²)',
      ['Use +√ for the upper half and -√ for the lower half.', 'r controls the width of the arc.', 'The natural domain runs from h-r to h+r.'],
      'For a lower radius-4 semicircle centred at the origin: y = -√(16-x²).',
      'Choose upper or lower first, then set centre and radius.'),
    16: lesson('Sine waves', 'Sine produces a repeating wave. Multiplying sin(x) changes its height without changing the basic repeating shape.', 'y = A·sin(x)',
      ['A is the amplitude.', 'The wave oscillates above and below its centre line.', 'A larger |A| makes higher crests and deeper troughs.'],
      'y = 2sin(x) has amplitude 2, so its peaks reach about 2 and -2.',
      'Match the wave height before worrying about other transformations.'),
    17: lesson('Cosine waves', 'Cosine behaves like sine but begins at a crest when x = 0 in its basic form.', 'y = A·cos(x)',
      ['A controls amplitude.', 'cos(0) = 1, so an unshifted cosine starts at its maximum.', 'Sine and cosine share the same period in their basic forms.'],
      'y = 2cos(x) starts at y = 2 when x = 0.',
      'Use the starting position of the wave as a clue.'),
    18: lesson('Combining functions', 'A custom path can add two familiar functions together. Each part contributes to the final shape.', 'y = sin(x) + mx',
      ['The sine term creates oscillation.', 'The linear term adds an overall upward or downward trend.', 'Both effects happen at the same time at every x-value.'],
      'sin(x) + 0.2x still waves, but its centre line gradually rises.',
      'Break a complex expression into familiar pieces.'),
  };

  function lesson(title, body, formula, points, example, summary) {
    return { title, body, formula, points, example, summary };
  }

  function loadSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { completed: data.completed || {}, learned: data.learned || {}, lastIndex: data.lastIndex || 0 };
    } catch {
      return { completed: {}, learned: {}, lastIndex: 0 };
    }
  }

  function persist() {
    saved.lastIndex = currentIndex;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {}
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function current() { return levels[currentIndex]; }
  function phaseLevels(phaseId) { return levels.filter((l) => l.phase === phaseId); }
  function completedCount(phaseId) { return phaseLevels(phaseId).filter((l) => saved.completed[l.id]).length; }

  function init() {
    bind();
    renderPhaseTabs();
    loadLevel(currentIndex);
    requestAnimationFrame(() => { renderer.resize(); draw(); });
    window.addEventListener('resize', () => { renderer.resize(); draw(); });
  }

  function bind() {
    $('#backToQuizmoto').addEventListener('click', () => { location.href = '/scorm/quizmoto'; });
    $('#reviewLessonBtn').addEventListener('click', openLesson);
    $('#startChallengeBtn').addEventListener('click', finishLesson);
    $('#addFormulaBtn').addEventListener('click', addFormula);
    $('#formulaForm').addEventListener('submit', (e) => { e.preventDefault(); addFormula(); });
    $('#formulaInput').addEventListener('input', onFormulaInput);
    $('#clearEquationsBtn').addEventListener('click', () => {
      if (physics?.running) return;
      userSurfaces = []; preview = null;
      $('#formulaInput').value = ''; $('#formulaError').textContent = '';
      renderEquationList(); draw(); updateBudget(); updateJourney();
      status('Equations cleared. Build the mission again.', 'info');
    });
    $('.math-keys').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]'); if (!btn) return;
      insertAtCursor($('#formulaInput'), btn.dataset.key); onFormulaInput();
    });
    $('#hintBtn').addEventListener('click', toggleHint);
    $('#actionBtn').addEventListener('click', runAction);
    $('#resetBtn').addEventListener('click', resetRun);
    $('#closeResultBtn').addEventListener('click', closeModal);
    $('#replayBtn').addEventListener('click', () => { closeModal(); loadLevel(currentIndex); });
    $('#nextBtn').addEventListener('click', nextMission);
    $('#resultModal').addEventListener('click', (e) => { if (e.target.id === 'resultModal') closeModal(); });
  }

  function renderPhaseTabs() {
    const wrap = $('#phaseTabs'); wrap.innerHTML = '';
    for (const phase of phases) {
      const list = phaseLevels(phase.id), done = completedCount(phase.id), active = current().phase === phase.id;
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = `phase-tab${active ? ' active' : ''}`;
      btn.innerHTML = `<span>${escapeHtml(phase.name)}</span><small>${escapeHtml(phase.subtitle)}</small><b>${done}/${list.length}</b>`;
      btn.addEventListener('click', () => {
        const firstIncomplete = list.find((l) => !saved.completed[l.id]) || list[0];
        loadLevel(levels.indexOf(firstIncomplete));
      });
      wrap.appendChild(btn);
    }
  }

  function renderMissionList() {
    const list = phaseLevels(current().phase), wrap = $('#missionList'); wrap.innerHTML = '';
    list.forEach((level) => {
      const idx = levels.indexOf(level), done = saved.completed[level.id];
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = `mission-item${idx === currentIndex ? ' active' : ''}${done ? ' complete' : ''}`;
      btn.innerHTML = `<span class="mission-num">${String(level.id).padStart(2, '0')}</span><span class="mission-copy"><strong>${escapeHtml(level.title)}</strong><small>${escapeHtml(level.family)}</small></span><span class="mission-state">${done ? '★'.repeat(done.stars || 1) : '○'}</span>`;
      btn.addEventListener('click', () => loadLevel(idx)); wrap.appendChild(btn);
    });
  }

  function loadLevel(index) {
    stopAnimation(); currentIndex = clamp(index, 0, levels.length - 1);
    const level = current(), guide = lessonFor(level);
    userSurfaces = []; preview = null; physics = null; hintUsed = false; attempts = 0;
    $('#formulaInput').value = ''; $('#formulaError').textContent = '';
    $('#hintPanel').classList.add('hidden'); $('#hintBtn').classList.remove('active');
    $('#missionPhase').textContent = level.phase === 'shape' ? 'Shape Academy' : 'Gravity Campaign';
    $('#missionFamily').textContent = level.family;
    $('#missionTitle').textContent = level.title;
    $('#missionDescription').textContent = level.description;
    $('#modeBadge').textContent = level.phase === 'shape' ? 'Construction' : 'Physics';
    $('#conceptSummary').textContent = guide.summary;
    $('#objectiveText').textContent = level.phase === 'shape'
      ? 'Recreate the glowing target using the equation ideas from the lesson. The shape must match both its form and its domain.'
      : `Build up to ${level.budget} formula ramp${level.budget > 1 ? 's' : ''}, then release the ball and collect every star before reaching the basket.`;
    $('#formulaHelp').textContent = helpFor(level);
    $('#hintText').textContent = level.hint || '';
    $('#hintFormula').innerHTML = (level.target || level.solution || []).map((f) => `<code>${escapeHtml(f)}</code>`).join('');
    $('#physicsHud').classList.toggle('hidden', level.phase !== 'gravity');
    $('#actionBtn').classList.toggle('physics-action', level.phase === 'gravity');
    setAction(level.phase === 'shape' ? 'Check shape' : 'Drop ball');
    $('#resetBtn').textContent = level.phase === 'shape' ? 'Reset construction' : 'Reset ball / view';
    renderMissionList(); renderPhaseTabs(); renderEquationList(); updateBudget(); updateTopStats(); updatePhysicsHud(); updateJourney();
    persist(); draw();
    if (!saved.learned[level.id]) {
      status('Start with the short concept guide. Then build the solution yourself.', 'info'); openLesson();
    } else {
      status(level.phase === 'shape'
        ? 'Use what you learned to match the glowing target. Your equation previews live as you type.'
        : 'Build the ramp from the concept you learned, then release the ball and observe the physics.', 'info');
      $('#lessonOverlay').classList.add('hidden');
    }
  }

  function lessonFor(level) {
    if (SHAPE_LESSONS[level.id]) return SHAPE_LESSONS[level.id];
    const key = `${level.family} ${level.title}`.toLowerCase();
    if (key.includes('domain')) return lesson('Domains become track segments', 'In the physics campaign, the domain is not just visual notation. It decides exactly where a ramp physically exists.', 'y = f(x) ; [min, max]', ['The function creates the surface.', 'The domain cuts that surface to a usable track segment.', 'Small gaps can make the ball jump; overlaps can create smoother transfers.'], 'A line such as y = -0.5x ; [-5,0] exists only from x=-5 to x=0, so the ball leaves the surface after that point.', 'A domain controls where the physical ramp begins and ends.');
    if (key.includes('quadratic') || key.includes('parabola')) return lesson('Curved quadratic ramps', 'A quadratic gives the ball a continuously changing slope, so gravity accelerates it differently along different parts of the curve.', 'y = ax² + bx + c', ['a controls how strongly the ramp bends.', 'b tilts the overall direction of the quadratic.', 'c moves the ramp vertically.'], 'A small positive a can create a gently curving downhill ramp when the linear term also slopes downward.', 'Quadratics make ramps whose steepness changes continuously.');
    if (key.includes('circle') || key.includes('arc') || key.includes('halfpipe')) return lesson('Circular collision surfaces', 'Circle and semicircle formulas become solid curved surfaces. The ball can roll around them, enter a halfpipe or bounce from a circular bumper.', '(x-h)² + (y-k)² = r²', ['h and k move the centre.', 'r changes the size of the circle or arc.', 'For a semicircle, choose +√ or -√ to keep only the upper or lower half.'], 'A lower semicircle y = -√(16-x²) acts like a bowl: gravity pulls the ball down one side and momentum can carry it up the other.', 'Circular formulas create bowls, loops and bumpers for the ball.');
    if (key.includes('sine') || key.includes('cosine') || key.includes('wave') || key.includes('trig')) return lesson('Wave ramps', 'Trigonometric functions produce smooth repeating terrain. The ball feels every crest and trough as a real surface.', 'y = A·sin(Bx + C) + D', ['A controls wave height.', 'B controls how closely the waves repeat.', 'C and D shift the wave horizontally and vertically.'], 'A downhill linear trend can be added to a sine wave so the ball keeps progressing while still riding the oscillations.', 'Wave parameters control the height, spacing and position of physical terrain.');
    if (key.includes('absolute')) return lesson('Absolute-value ramps', 'Absolute value creates a sharp V-shaped path with a single vertex.', 'y = a|x-h| + k', ['a controls the side slopes.', '(h,k) is the vertex.', 'The V can point upward or downward depending on the sign of a.'], 'y = |x| creates a V with its corner at the origin.', 'Absolute value is useful when you need a deliberate sharp corner.');
    if (key.includes('root')) return lesson('Square-root ramps', 'A square-root graph begins at one endpoint and then changes slope gradually, making it useful for one-sided ramps.', 'y = a√(x-h) + k', ['h sets where the real-valued curve begins.', 'k sets the starting height.', 'a stretches, flips or compresses the curve.'], 'y = √(x+4)-2 begins at (-4,-2) and continues only to the right.', 'Square-root functions naturally create one-sided tracks.');
    if (key.includes('cubic')) return lesson('Cubic S-curves', 'Cubics can create smooth S-shaped routes with a change in curvature around an inflection point.', 'y = a(x-h)³ + k', ['a controls how aggressively the curve rises or falls.', '(h,k) places the central inflection point.', 'Cubics grow quickly, so small coefficients are often easier to control.'], 'y = 0.05x³ creates a gentle S near the origin but becomes much steeper farther away.', 'Cubics are useful for smooth switchbacks and direction changes.');
    if (key.includes('exponential')) return lesson('Exponential ramps', 'An exponential changes slowly in one region and very rapidly in another, so the ball can experience a dramatic change of slope.', 'y = a·b^(x-h) + k', ['b > 1 creates growth while 0 < b < 1 creates decay.', 'a scales the curve.', 'h and k shift the curve around the board.'], 'With b = 1.5, equal steps in x multiply the exponential part by the same factor.', 'Exponential functions create ramps whose steepness changes rapidly.');
    if (key.includes('mixed') || key.includes('combo') || key.includes('transfer')) return lesson('Connecting different formula families', 'A complete route does not need one giant equation. You can combine separate ramps and give each one a domain.', 'curve + line + domains', ['Choose the best function for each part of the route.', 'Use domains so one surface hands the ball to the next.', 'Watch the ball, then adjust the transfer point instead of changing everything at once.'], 'A parabola can guide the first descent, then a bounded line can catch the ball and lead it into the basket.', 'Complex courses are easier when you solve them as connected sections.');
    if (key.includes('slope') || key.includes('linear')) return lesson('Slope controls the ride', 'A line equation becomes a physical ramp. Gravity pulls downward while the ramp redirects that force along its surface.', 'y = mx + c', ['m controls steepness and direction.', 'A negative m creates a downhill path from left to right.', 'c positions the ramp vertically without changing its slope.'], 'A gentle negative slope gives a controlled descent; a larger negative slope accelerates the ball more aggressively.', 'The slope you write directly changes how the ball accelerates.');
    return lesson('Formula surfaces', 'Every equation you add to the board becomes geometry the ball can physically touch.', 'y = f(x)', ['Write a function that passes through the route you want.', 'Restrict it with a domain when only part of the curve should exist.', 'Test the ball, observe where it leaves the path and refine the equation.'], 'The fastest way to improve a route is to change one parameter at a time and watch how the graph and ball respond.', 'The equation is both a mathematical graph and a physical surface.');
  }

  function helpFor(level) {
    const key = `${level.family} ${level.title}`.toLowerCase();
    if (key.includes('circle')) return 'Circle syntax: (x-h)^2 + (y-k)^2 = r^2. Example: x^2 + y^2 = 9.';
    if (key.includes('sine') || key.includes('cosine') || key.includes('wave')) return 'Use sin(x) or cos(x). Multiply to change amplitude and add ; [min, max] for a bounded wave.';
    if (key.includes('semicircle') || key.includes('arc') || key.includes('halfpipe')) return 'Use sqrt(...). A minus before sqrt creates a lower semicircle; a plus creates an upper semicircle.';
    if (key.includes('domain') || level.budget > 1) return 'Add ; [min, max] after a formula when a ramp or edge should exist only across part of the board.';
    return level.phase === 'shape' ? 'You can write y = expressions directly. For a vertical line use x = constant. Add ; [min, max] to limit a segment.' : 'The cyan equation becomes a solid ramp when you press Drop ball. Use a domain to control where the ramp exists.';
  }

  function openLesson() {
    const guide = lessonFor(current());
    $('#lessonKicker').textContent = current().phase === 'shape' ? 'Learn before you build' : 'Learn before you run the physics';
    $('#lessonTitle').textContent = guide.title; $('#lessonBody').textContent = guide.body;
    $('#lessonFormula').textContent = guide.formula; $('#lessonExample').textContent = guide.example;
    guide.points.slice(0, 3).forEach((point, i) => { $(`#lessonPoint${i + 1}`).textContent = point; });
    const titles = current().phase === 'shape' ? ['Read the formula', 'See what each part changes', 'Use it to construct'] : ['Build the surface', 'Predict the motion', 'Test and refine'];
    titles.forEach((title, i) => { $(`#lessonPointTitle${i + 1}`).textContent = title; });
    $('#lessonOverlay').classList.remove('hidden'); updateJourney();
  }

  function finishLesson() {
    saved.learned[current().id] = true; persist(); $('#lessonOverlay').classList.add('hidden'); updateJourney();
    status(current().phase === 'shape' ? 'Lesson complete. Now recreate the glowing target by writing the equation yourself.' : 'Lesson complete. Build the formula ramp, then release the ball to test your prediction.', 'info');
    setTimeout(() => $('#formulaInput').focus(), 80);
  }

  function updateJourney() {
    const learned = !!saved.learned[current().id], built = userSurfaces.length > 0, tested = attempts > 0 || !!physics;
    const steps = [$('#stepLearn'), $('#stepBuild'), $('#stepTest')];
    steps.forEach((el) => el.classList.remove('active', 'complete'));
    if (!learned) steps[0].classList.add('active'); else steps[0].classList.add('complete');
    if (learned && !built) steps[1].classList.add('active'); else if (built) steps[1].classList.add('complete');
    if (built) steps[2].classList.add(tested ? 'complete' : 'active');
  }

  function onFormulaInput() {
    const raw = $('#formulaInput').value.trim();
    if (!raw) { preview = null; $('#formulaError').textContent = ''; draw(); return; }
    try { preview = E.parseEquation(raw, true); $('#formulaError').textContent = ''; }
    catch (err) { preview = null; $('#formulaError').textContent = err.message || 'Invalid equation'; }
    draw();
  }

  function addFormula() {
    if (physics?.running) return;
    const level = current();
    if (!saved.learned[level.id]) { openLesson(); return; }
    if (userSurfaces.length >= level.budget) { status(`This mission allows ${level.budget} equation${level.budget === 1 ? '' : 's'}. Remove one before adding another.`, 'warn'); return; }
    const raw = $('#formulaInput').value.trim();
    if (!raw) { $('#formulaError').textContent = 'Write an equation first.'; return; }
    try {
      const eq = E.parseEquation(raw); userSurfaces.push(eq); preview = null;
      $('#formulaInput').value = ''; $('#formulaError').textContent = '';
      renderEquationList(); updateBudget(); updateJourney(); draw(); beep(420, .035);
      status(current().phase === 'gravity' ? 'Ramp added. Add another section if needed, then drop the ball.' : 'Equation added. Compare it with the target and add the next edge if needed.', 'info');
    } catch (err) { $('#formulaError').textContent = err.message || 'Invalid equation'; }
  }

  function renderEquationList() {
    const wrap = $('#equationList'); wrap.innerHTML = '';
    if (!userSurfaces.length) { wrap.innerHTML = '<div class="empty-equations">Your formulas will appear here after you add them.</div>'; return; }
    userSurfaces.forEach((eq, i) => {
      const row = document.createElement('div'); row.className = 'equation-row';
      row.innerHTML = `<span class="equation-index">${i + 1}</span><code>${escapeHtml(eq.raw)}</code><button type="button" aria-label="Remove equation">×</button>`;
      row.querySelector('button').addEventListener('click', () => { if (physics?.running) return; userSurfaces.splice(i, 1); renderEquationList(); updateBudget(); updateJourney(); draw(); });
      wrap.appendChild(row);
    });
  }

  function updateBudget() { $('#budgetValue').textContent = `${userSurfaces.length} / ${current().budget}`; }
  function toggleHint() { const panel = $('#hintPanel'), opening = panel.classList.contains('hidden'); panel.classList.toggle('hidden'); $('#hintBtn').classList.toggle('active', opening); if (opening) hintUsed = true; }

  function runAction() {
    const level = current();
    if (!saved.learned[level.id]) { openLesson(); return; }
    if (level.phase === 'shape') checkShape();
    else if (physics?.running) stopRun();
    else if (physics && !physics.running && physics.time > 0) resumeRun();
    else startGravity();
  }

  function checkShape() {
    attempts++; updateJourney();
    if (!userSurfaces.length) { status('Add at least one equation before checking the construction.', 'warn'); return; }
    const targets = levelEquations(current().target), result = E.compareGeometry(userSurfaces, targets);
    if (result.pass) {
      const stars = hintUsed ? 2 : attempts === 1 ? 3 : 2;
      status(`Great match — ${(result.score * 100).toFixed(0)}% geometry accuracy.`, 'success');
      completeLevel(stars, `You used ${userSurfaces.length} equation${userSurfaces.length === 1 ? '' : 's'} to construct the target accurately.`);
    } else { status(`Current match: ${(result.score * 100).toFixed(0)}%. Compare the endpoints, signs and domain limits, then adjust one part at a time.`, 'warn'); beep(150, .06); }
  }

  function startGravity() {
    const level = current();
    if (!userSurfaces.length) { status('Build at least one formula ramp before dropping the ball.', 'warn'); return; }
    stopAnimation(); attempts++;
    physics = new E.PhysicsRun(level, userSurfaces, () => { starBeepIndex++; beep(600 + starBeepIndex * 80, .04); updatePhysicsHud(); });
    starBeepIndex = 0; lastTs = 0; accumulator = 0; setAction('Pause run'); updateJourney();
    status('Ball released. Gravity is active and your equations are now physical surfaces.', 'info'); draw(); raf = requestAnimationFrame(frame);
  }

  function resumeRun() {
    if (!physics) return; physics.running = true; lastTs = 0; accumulator = 0; setAction('Pause run'); status('Physics resumed.', 'info'); raf = requestAnimationFrame(frame);
  }

  function frame(ts) {
    if (!physics?.running) return;
    if (!lastTs) lastTs = ts;
    let elapsed = Math.min(.05, (ts - lastTs) / 1000); lastTs = ts; accumulator += elapsed;
    let result = null;
    while (accumulator >= 1 / 120 && !result) { result = physics.step(1 / 120); accumulator -= 1 / 120; }
    updatePhysicsHud(); draw();
    if (result) {
      setAction('Try again'); updateJourney();
      if (result.won) {
        beep(880, .08); setTimeout(() => beep(1100, .08), 90);
        const ratio = Math.max(0, 1 - physics.time / current().timeLimit), stars = hintUsed ? 2 : ratio > .55 ? 3 : ratio > .25 ? 2 : 1;
        status(`Success — ${result.collected}/${physics.stars.length} stars collected and the ball reached the basket.`, 'success');
        completeLevel(stars, 'Your equations formed a working physical route through every star and into the basket.');
      } else { status(`Run ended with ${result.collected}/${physics.stars.length} stars. Watch where the ball left the ramp, then refine that section.`, 'warn'); beep(140, .06); }
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function stopRun() { if (!physics) return; physics.running = false; cancelAnimationFrame(raf); raf = 0; setAction('Resume run'); status('Physics paused. Resume this run or reset the ball if you want to edit the equations.', 'info'); }

  function resetRun() {
    stopAnimation();
    if (current().phase === 'shape') { userSurfaces = []; preview = null; $('#formulaInput').value = ''; renderEquationList(); updateBudget(); status('Construction cleared. The target remains visible so you can rebuild it.', 'info'); }
    else { physics = null; status('Ball reset. Your formula ramps remain on the board so you can edit or test again.', 'info'); }
    setAction(current().phase === 'shape' ? 'Check shape' : 'Drop ball'); updatePhysicsHud(); updateJourney(); draw();
  }

  function completeLevel(stars, text) {
    const level = current(), prev = saved.completed[level.id]?.stars || 0;
    saved.completed[level.id] = { stars: Math.max(prev, stars) }; persist(); updateTopStats(); renderMissionList(); renderPhaseTabs(); updateJourney();
    $('#resultPhase').textContent = level.phase === 'shape' ? 'Shape mastered' : 'Gravity run complete';
    $('#resultTitle').textContent = level.title; $('#resultStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars); $('#resultText').textContent = text;
    $('#nextBtn').textContent = currentIndex === levels.length - 1 ? 'Finish' : 'Next mission'; $('#resultModal').classList.remove('hidden');
  }

  function nextMission() { closeModal(); if (currentIndex < levels.length - 1) loadLevel(currentIndex + 1); else status('All Geometry Physics missions completed. Replay any mission to improve your stars.', 'success'); }
  function closeModal() { $('#resultModal').classList.add('hidden'); }
  function updateTopStats() { const done = Object.keys(saved.completed).filter((id) => saved.completed[id]).length; $('#totalProgress').textContent = `${done}/${levels.length}`; $('#levelCounter').textContent = `${currentIndex + 1} / ${levels.length}`; const best = saved.completed[current().id]?.stars || 0; $('#savedStars').textContent = '★'.repeat(best) + '☆'.repeat(3 - best); }
  function updatePhysicsHud() { const level = current(); if (level.phase !== 'gravity') return; const count = physics ? physics.stars.filter((s) => s.collected).length : 0; $('#starHud').textContent = `${count} / ${level.stars.length}`; const remain = physics ? Math.max(0, level.timeLimit - physics.time) : level.timeLimit; $('#timeHud').textContent = `${remain.toFixed(remain < 10 ? 1 : 0)}s`; }
  function draw() { renderer.render(current(), userSurfaces, preview, physics); }
  function levelEquations(items) { return (items || []).map((raw) => E.parseEquation(raw)); }
  function setAction(text) { $('#actionBtn').textContent = text; }
  function status(message, type = 'info') { const el = $('#statusMessage'); el.textContent = message; el.dataset.type = type; }
  function stopAnimation() { if (raf) cancelAnimationFrame(raf); raf = 0; if (physics) physics.running = false; lastTs = 0; accumulator = 0; }
  function insertAtCursor(input, text) { const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? start; input.value = input.value.slice(0, start) + text + input.value.slice(end); const pos = start + text.length; input.focus(); input.setSelectionRange(pos, pos); }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  let audioCtx;
  function beep(freq, duration) {
    try { audioCtx ||= new (window.AudioContext || window.webkitAudioContext)(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = freq; o.type = 'sine'; g.gain.setValueAtTime(.035, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + duration); } catch {}
  }

  init();
})();
