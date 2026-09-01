(() => {
  'use strict';

  const FAMILY = {
    linear: {
      formula: p => `y = ${fmt(p.m)}x ${signed(p.c)}`,
      fn: (x,p) => p.m*x+p.c,
      params: [P('m','Slope m',-2.5,2.5,.1), P('c','Intercept c',-4,4,.1)],
      lesson: 'Slope controls steepness and direction; c moves the line up or down.'
    },
    quadratic: {
      formula: p => `y = ${fmt(p.a)}(x ${shift(p.h)})² ${signed(p.k)}`,
      fn: (x,p) => p.a*(x-p.h)*(x-p.h)+p.k,
      params: [P('a','Curve a',-.8,.8,.05), P('h','Horizontal shift h',-3,3,.25), P('k','Vertical shift k',-4,4,.25)],
      lesson: 'Vertex form y=a(x−h)²+k makes the turning point (h,k) easy to see.'
    },
    absolute: {
      formula: p => `y = ${fmt(p.a)}|x ${shift(p.h)}| ${signed(p.k)}`,
      fn: (x,p) => p.a*Math.abs(x-p.h)+p.k,
      params: [P('a','V slope a',-2,2,.1), P('h','Vertex x h',-3,3,.25), P('k','Vertex y k',-4,4,.25)],
      lesson: 'Absolute-value graphs form a V. The vertex is at (h,k).'
    },
    semicircleLower: {
      formula: p => `y = ${fmt(p.k)} − √(${fmt(p.r)}² − (x ${shift(p.h)})²)`,
      fn: (x,p) => { const d=p.r*p.r-(x-p.h)*(x-p.h); return d<0?null:p.k-Math.sqrt(d); },
      params: [P('h','Centre x h',-2.5,2.5,.25), P('k','Centre y k',-1,4,.25), P('r','Radius r',1.5,5,.25)],
      lesson: 'A semicircle comes from the circle equation (x−h)²+(y−k)²=r².'
    },
    sine: {
      formula: p => `y = ${fmt(p.A)} sin(${fmt(p.B)}(x ${shift(p.C)})) ${signed(p.D)}`,
      fn: (x,p) => p.A*Math.sin(p.B*(x-p.C))+p.D,
      params: [P('A','Amplitude A',.5,3.5,.25), P('B','Frequency B',.4,2.2,.1), P('C','Phase shift C',-2,2,.25), P('D','Vertical shift D',-2.5,2.5,.25)],
      lesson: 'A changes wave height, B changes frequency, C shifts sideways and D shifts vertically.'
    },
    cosine: {
      formula: p => `y = ${fmt(p.A)} cos(${fmt(p.B)}(x ${shift(p.C)})) ${signed(p.D)}`,
      fn: (x,p) => p.A*Math.cos(p.B*(x-p.C))+p.D,
      params: [P('A','Amplitude A',.5,3.5,.25), P('B','Frequency B',.4,2.2,.1), P('C','Phase shift C',-2,2,.25), P('D','Vertical shift D',-2.5,2.5,.25)],
      lesson: 'Cosine uses the same transformations as sine, but starts at a crest when unshifted.'
    },
    cubic: {
      formula: p => `y = ${fmt(p.a)}(x ${shift(p.h)})³ ${signed(p.k)}`,
      fn: (x,p) => p.a*Math.pow(x-p.h,3)+p.k,
      params: [P('a','Cubic scale a',-.22,.22,.01), P('h','Horizontal shift h',-2,2,.25), P('k','Vertical shift k',-3,3,.25)],
      lesson: 'Cubic curves have an S-shape and an inflection point near (h,k).'
    },
    sqrt: {
      formula: p => `y = ${fmt(p.a)}√(x ${shift(p.h)}) ${signed(p.k)}`,
      fn: (x,p) => x-p.h<0?null:p.a*Math.sqrt(x-p.h)+p.k,
      params: [P('a','Stretch a',-2.5,2.5,.1), P('h','Start x h',-5,2,.25), P('k','Start y k',-3,3,.25)],
      lesson: 'Square-root graphs begin at x=h; values left of h are outside the real-number domain.'
    },
    reciprocal: {
      formula: p => `y = ${fmt(p.a)} / (x ${shift(p.h)}) ${signed(p.k)}`,
      fn: (x,p) => Math.abs(x-p.h)<.08?null:p.a/(x-p.h)+p.k,
      params: [P('a','Scale a',-4,4,.25), P('h','Vertical asymptote h',-2,2,.25), P('k','Horizontal asymptote k',-2.5,2.5,.25)],
      lesson: 'Reciprocal graphs approach asymptotes x=h and y=k without touching them.'
    },
    exponential: {
      formula: p => `y = ${fmt(p.a)}·${fmt(p.b)}^(x ${shift(p.h)}) ${signed(p.k)}`,
      fn: (x,p) => p.a*Math.pow(p.b,x-p.h)+p.k,
      params: [P('a','Scale a',.2,2,.1), P('b','Base b',.4,2,.1), P('h','Horizontal shift h',-2,2,.25), P('k','Vertical shift k',-3,2,.25)],
      lesson: 'For b>1 the curve grows; for 0<b<1 it decays. k is the horizontal asymptote.'
    }
  };

  const chapters = [
    {name:'Coordinate Basics', subtitle:'Slope · midpoint · distance · lines'},
    {name:'Triangle Lab', subtitle:'Angles · area · Pythagoras · Heron'},
    {name:'Shape Workshop', subtitle:'Quadrilaterals · polygons'},
    {name:'Circle Station', subtitle:'Circumference · area · arcs · sectors'},
    {name:'Curve Engineering', subtitle:'Quadratic · absolute · circles'},
    {name:'Trig Waves', subtitle:'sin · cos · tan · waves'},
    {name:'3D Geometry', subtitle:'Volume · surface area'},
    {name:'Master Functions', subtitle:'Cubic · root · reciprocal · exponential'}
  ];

  const levels = [
    Q(1,1,'Slope Signal','Find the slope between A(−2,1) and B(4,4).','m = (y₂ − y₁) / (x₂ − x₁)', ['1/2','2','3/2','−1/2'],0,'Rise is 3 and run is 6, so m=3/6=1/2.','Slope measures change in y for each unit change in x.','Subtract coordinates in the same order for numerator and denominator.'),
    Q(2,1,'Midpoint Beacon','What is the midpoint of A(−4,2) and B(6,8)?','M = ((x₁+x₂)/2, (y₁+y₂)/2)', ['(1,5)','(2,5)','(1,4)','(5,1)'],0,'Average the x-values and y-values: (1,5).','The midpoint is exactly halfway between two points.','Average the two x-coordinates, then average the two y-coordinates.'),
    Q(3,1,'Distance Jump','Find the distance from (1,2) to (4,6).','d = √((x₂−x₁)² + (y₂−y₁)²)', ['5','7','√7','4'],0,'Δx=3 and Δy=4, so d=√(9+16)=5.','The distance formula is Pythagoras on the coordinate plane.','This is a 3–4–5 right triangle.'),
    C(4,1,'Intercept Run','Tune a line so the orb passes through all three energy stars.','linear',{m:-.7,c:.8},{m:.2,c:0},'Use slope and intercept together: y=mx+c.','A negative slope falls as x increases. The intercept sets the height at x=0.'),

    Q(5,2,'Angle Core','A triangle has angles 48° and 67°. Find the third angle.','A + B + C = 180°',['65°','75°','55°','85°'],0,'180−48−67=65°.','Every triangle has an interior angle sum of 180°.','Subtract both known angles from 180°.'),
    Q(6,2,'Area Launch','A triangle has base 12 cm and height 7 cm. Find its area.','A = ½bh',['42 cm²','84 cm²','19 cm²','38 cm²'],0,'A=½×12×7=42 cm².','Triangle area is half the area of a matching parallelogram.','Multiply base by perpendicular height, then halve it.'),
    Q(7,2,'Pythagoras Portal','A right triangle has legs 6 and 8. Find the hypotenuse.','c = √(a² + b²)',['10','14','√28','12'],0,'c=√(36+64)=10.','Pythagoras links the three sides of a right triangle.','6–8–10 is a scaled 3–4–5 triangle.'),
    Q(8,2,'Heron Vault','A triangle has sides 5, 5 and 6. Which formula finds area using only side lengths?','A = √(s(s−a)(s−b)(s−c)),  s=(a+b+c)/2',['Heron’s formula','Pythagorean theorem','Cosine rule','Arc-length formula'],0,'Heron’s formula uses the semiperimeter s and all three side lengths.','Use Heron when height is not given but all three sides are known.','Look for the formula containing the semiperimeter s.'),

    Q(9,3,'Rectangle Grid','A rectangle is 9 m by 4 m. What is its area?','A = lw',['36 m²','26 m²','13 m²','18 m²'],0,'9×4=36 m².','Rectangle area counts the number of unit squares inside.','Length × width.'),
    Q(10,3,'Parallelogram Shift','A parallelogram has base 11 cm and perpendicular height 5 cm. Area?','A = bh',['55 cm²','32 cm²','27.5 cm²','16 cm²'],0,'A=11×5=55 cm².','Slanting the side does not change area if base and perpendicular height stay fixed.','Use perpendicular height, not the slanted side.'),
    Q(11,3,'Trapezium Bridge','Parallel sides are 8 cm and 14 cm; height is 5 cm. Find area.','A = ½(a+b)h',['55 cm²','110 cm²','35 cm²','70 cm²'],0,'½×(8+14)×5=55 cm².','A trapezium’s area uses the average of the parallel sides times height.','Add the parallel sides first.'),
    Q(12,3,'Polygon Reactor','What is the sum of interior angles of a hexagon?','S = (n − 2) × 180°',['720°','540°','900°','1080°'],0,'(6−2)×180=720°.','Any n-sided polygon can be divided into n−2 triangles.','A hexagon has n=6.'),

    Q(13,4,'Orbit Length','A circle has radius 5 cm. What is its circumference?','C = 2πr',['10π cm','25π cm','5π cm','20π cm'],0,'C=2π×5=10π cm.','Circumference measures distance around the circle.','Double the radius, then multiply by π.'),
    Q(14,4,'Circle Charge','A circle has radius 4 m. Find its area.','A = πr²',['16π m²','8π m²','4π m²','32π m²'],0,'A=π×4²=16π m².','Circle area grows with the square of the radius.','Square the radius before multiplying by π.'),
    Q(15,4,'Arc Runner','A 90° arc lies on a circle of radius 8 cm. Find its arc length.','L = (θ/360°) × 2πr',['4π cm','8π cm','16π cm','2π cm'],0,'A 90° arc is one quarter of the circle: ¼×16π=4π cm.','Arc length is the same fraction of circumference as θ is of 360°.','90° is one quarter of a full turn.'),
    Q(16,4,'Sector Shield','A 60° sector has radius 6 cm. What is its area?','A = (θ/360°) × πr²',['6π cm²','12π cm²','18π cm²','36π cm²'],0,'60/360×π×36=6π cm².','Sector area is a fraction of full-circle area.','60/360=1/6.'),

    C(17,5,'Parabola Bowl','Shape a parabola that catches every star before the orb reaches the portal.','quadratic',{a:.22,h:0,k:-2},{a:.55,h:-1,k:0},'Use vertex form y=a(x−h)²+k.','The target bowl is wide, centred near x=0 and sits below the x-axis.'),
    C(18,5,'Absolute Canyon','Build a V-shaped path through the three star gates.','absolute',{a:.65,h:.5,k:-2},{a:1.4,h:-1.5,k:0},'Absolute value creates a V with vertex (h,k).','Move the vertex first, then adjust the V slope.'),
    C(19,5,'Semicircle Halfpipe','Tune the centre and radius of the lower semicircle.','semicircleLower',{h:0,k:2.2,r:4.2},{h:-1,k:1,r:2.5},'The radius controls width; h and k move the circle centre.','For the lower half, the square-root term is subtracted from k.'),
    Q(20,5,'Circle Equation','Which equation describes a circle centred at (2,−1) with radius 3?','(x − h)² + (y − k)² = r²',['(x−2)²+(y+1)²=9','(x+2)²+(y−1)²=3','(x−2)²+(y−1)²=6','x²+y²=9'],0,'Centre (2,−1) gives (x−2)²+(y+1)², and r²=9.','The signs inside the brackets are opposite the centre coordinates.','Use h=2, k=−1 and r=3.'),

    Q(21,6,'Sine Scanner','In a right triangle, which ratio equals sin θ?','sin θ = opposite / hypotenuse',['opposite / hypotenuse','adjacent / hypotenuse','opposite / adjacent','hypotenuse / opposite'],0,'Sine is opposite over hypotenuse.','SOH: Sine = Opposite / Hypotenuse.','Remember SOH–CAH–TOA.'),
    Q(22,6,'Cosine Scanner','In a right triangle, which ratio equals cos θ?','cos θ = adjacent / hypotenuse',['adjacent / hypotenuse','opposite / hypotenuse','opposite / adjacent','hypotenuse / adjacent'],0,'Cosine is adjacent over hypotenuse.','CAH: Cosine = Adjacent / Hypotenuse.','Remember SOH–CAH–TOA.'),
    Q(23,6,'Tangent Scanner','In a right triangle, which ratio equals tan θ?','tan θ = opposite / adjacent',['opposite / adjacent','adjacent / hypotenuse','opposite / hypotenuse','adjacent / opposite'],0,'Tangent is opposite over adjacent.','TOA: Tangent = Opposite / Adjacent.','Remember SOH–CAH–TOA.'),
    C(24,6,'Sine Rider','Tune amplitude, frequency, phase and shift to match the energy wave.','sine',{A:2,B:.8,C:.5,D:-.4},{A:1,B:1.5,C:-1,D:1},'Match wave height first, then its spacing and horizontal shift.','A controls amplitude; B controls wave frequency; C and D translate the wave.'),

    Q(25,7,'Cuboid Cargo','A cuboid is 6×4×3 cm. Find its volume.','V = lwh',['72 cm³','36 cm³','54 cm³','13 cm³'],0,'6×4×3=72 cm³.','Volume counts cubic units inside a 3D object.','Multiply all three dimensions.'),
    Q(26,7,'Cylinder Tank','A cylinder has radius 3 m and height 5 m. Volume?','V = πr²h',['45π m³','30π m³','15π m³','90π m³'],0,'π×3²×5=45π m³.','Cylinder volume is base-circle area × height.','Find πr² first, then multiply by h.'),
    Q(27,7,'Cone Core','A cone has radius 3 cm and height 12 cm. Volume?','V = ⅓πr²h',['36π cm³','108π cm³','27π cm³','12π cm³'],0,'⅓×π×9×12=36π cm³.','A cone with the same base and height has one-third the volume of a cylinder.','Do the cylinder calculation, then divide by 3.'),
    Q(28,7,'Sphere Reactor','A sphere has radius 3 cm. Volume?','V = ⁴⁄₃πr³',['36π cm³','27π cm³','12π cm³','54π cm³'],0,'⁴⁄₃×π×27=36π cm³.','Sphere volume uses the cube of the radius.','3³=27.'),

    C(29,8,'Cubic Switchback','Tune an S-curve through the star field.','cubic',{a:.08,h:.5,k:-.3},{a:-.12,h:-1,k:1},'Cubic scale changes how quickly the S-curve rises and falls.','Keep |a| small: cubics grow very quickly away from the centre.'),
    C(30,8,'Root Ramp','Build a square-root ramp that starts at the correct point.','sqrt',{a:1.5,h:-4,k:-2.5},{a:.8,h:-2,k:0},'The graph only exists for x≥h. Put the start point first.','h defines the domain start; k sets its starting height.'),
    C(31,8,'Reciprocal Rift','Navigate around an asymptote without touching it.','reciprocal',{a:2.3,h:-.8,k:-.2},{a:-2,h:.8,k:1},'First align the asymptotes x=h and y=k, then adjust a.','The curve approaches, but never reaches, its vertical and horizontal asymptotes.'),
    C(32,8,'Exponential Finale','Match the growth curve to power the final portal.','exponential',{a:.35,b:1.55,h:-1,k:-2.3},{a:.8,b:.8,h:0,k:-1},'A base greater than 1 creates growth. Shift the curve until the stars align.','Exponential growth multiplies by the same factor over equal x-steps.')
  ];

  function P(key,label,min,max,step){ return {key,label,min,max,step}; }
  function Q(id,chapter,title,prompt,formula,options,correct,explanation,goal,hint){
    return {id,chapter,type:'quiz',title,description:'Solve the geometry mission to unlock the next formula.',prompt,formula,options,correct,explanation,goal,hint};
  }
  function C(id,chapter,title,description,family,target,start,hint,goal){
    return {id,chapter,type:'curve',title,description,family,target,start,formula:'',hint,goal,xMin:-5.5,xMax:5.5};
  }
  function fmt(n){
    if (Math.abs(n) < .0001) return '0';
    const rounded = Math.round(n*100)/100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }
  function signed(n){ return n>=0?`+ ${fmt(n)}`:`− ${fmt(Math.abs(n))}`; }
  function shift(h){ return h>=0?`− ${fmt(h)}`:`+ ${fmt(Math.abs(h))}`; }

  window.MathFlowContent = { FAMILY, chapters, levels, fmt };
})();
