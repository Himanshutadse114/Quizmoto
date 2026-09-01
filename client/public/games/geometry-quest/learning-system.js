(() => {
  'use strict';
  const data = window.GeometryGameData;
  if (!data?.levels) return;
  const $ = (s) => document.querySelector(s);
  const overlay = $('#lessonOverlay'), card = overlay?.querySelector('.lesson-card'), startBtn = $('#startChallengeBtn');
  const reviewBtn = $('#reviewLessonBtn'), statusEl = $('#statusMessage'), formulaForm = $('#formulaForm');
  if (!overlay || !card || !startBtn || !reviewBtn || !statusEl || !formulaForm) return;

  const STORE = 'quizmoto.geometry.deep-learning.v2';
  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } })();
  saved.mastered ||= {}; saved.seen ||= {};
  const persist = () => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch {} };

  let active = null, step = 0, answer = null, upgradedLevel = null;
  const course = document.createElement('section');
  course.id = 'guidedLearningCourse'; course.className = 'guided-learning-course hidden';
  card.insertBefore(course, card.querySelector('.lesson-footer'));

  const ref = document.createElement('section');
  ref.className = 'formula-reference-card';
  formulaForm.parentNode.insertBefore(ref, formulaForm);

  const coach = document.createElement('section');
  coach.className = 'math-coach hidden';
  statusEl.insertAdjacentElement('afterend', coach);

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const currentLevel = () => {
    const n = Math.max(1, parseInt($('#levelCounter')?.textContent || '1', 10) || 1);
    return data.levels[n - 1] || data.levels[0];
  };
  const keyFor = (l) => {
    const k = `${l?.family || ''} ${l?.title || ''}`.toLowerCase();
    if (l?.id === 1 || k.includes('horizontal line')) return 'horizontal';
    if (l?.id === 2 || k.includes('vertical line')) return 'vertical';
    if (k.includes('absolute')) return 'absolute';
    if (k.includes('semicircle') || k.includes('halfpipe') || k.includes('arc')) return 'semicircle';
    if (k.includes('circle')) return 'circle';
    if (k.includes('quadratic') || k.includes('parabola')) return 'quadratic';
    if (k.includes('sine') || k.includes('cosine') || k.includes('trig') || k.includes('wave')) return 'trig';
    if (k.includes('square-root') || k.includes('square root') || k.includes('root ramp')) return 'sqrt';
    if (k.includes('cubic')) return 'cubic';
    if (k.includes('exponential')) return 'exponential';
    if (k.includes('reciprocal') || k.includes('rational')) return 'reciprocal';
    if (k.includes('mixed') || k.includes('master') || k.includes('transfer')) return 'mixed';
    if (k.includes('domain') || k.includes('piecewise') || k.includes('staircase')) return 'domain';
    if (k.includes('polygon') || k.includes('triangle') || k.includes('trapez') || k.includes('diamond') || k.includes('roof')) return 'polygon';
    return 'linear';
  };

  const S = {
    horizontal: L('Horizontal lines','y = c','The y-value stays constant everywhere, so the line has zero slope.',[['c','height','moves the line up or down']],['Choose the required y-height.','Use that value as c.','Add a domain only if the platform must stop.'],'Example: y = 2; [-3,4] is a flat platform at height 2 from x=-3 to x=4.','What changes when c increases?',['The line gets steeper','The line moves upward','The line becomes vertical','Gravity increases'],1,'c changes position, not slope.','horizontal','c',-3,3,1,1),
    vertical: L('Vertical lines','x = c','x stays fixed while y changes, so the slope is undefined.',[['c','horizontal position','moves the line left or right']],['Read the required x-position.','Write x = c, not y = ...','Use the range after ; to bound the vertical segment.'],'Example: x = -2; [-1,3] draws a vertical segment through x=-2.','Which equation is vertical through x=3?',['y = 3','x = 3','y = 3x','x = y + 3'],1,'Vertical lines fix x, not y.','vertical','c',-3,3,1,1),
    linear: L('Straight-line equations','y = mx + c','m controls slope and c controls vertical position. In physics, slope changes how gravity accelerates the ball along the ramp.',[['m','slope','direction and steepness'],['c','intercept','vertical position']],['Pick two points on the ramp.','Calculate m = (y₂-y₁)/(x₂-x₁).','Substitute a point into y=mx+c to solve c.'],'Example: through (-2,2) and (2,0), m=-0.5 and c=1, so y=-0.5x+1.','If m becomes more negative, what happens?',['The descent becomes steeper','Only the height changes','It becomes a circle','The domain gets longer'],0,'Slope controls the ride; intercept controls placement.','linear','m',-1.5,1.5,.25,-.5),
    domain: L('Domains and track sections','y = f(x); [a, b]','A domain decides where the equation physically exists. It turns an infinite graph into a usable platform or ramp section.',[['a','start','first x-value'],['b','end','last x-value'],['f(x)','shape','the actual line or curve']],['Write the full equation first.','Choose the exact start and end x-values.','Add ; [a,b] and check how neighbouring sections meet.'],'Example: y=-0.5x+2; [-4,1] exists only between x=-4 and x=1.','What does [-4,1] control?',['Slope','Radius','Where the ramp exists','Gravity'],2,'A domain is a physical start-and-stop control.','domain','end b',-1,5,.5,2),
    polygon: L('Shapes from line segments','multiple y = mx + c equations + domains','Triangles, roofs and trapeziums are built from simple edges. Domains make those edges stop at the vertices.',[['m','edge slope','direction of each side'],['c','edge position','height of each side'],['domain','edge length','where each side stops']],['Mark the vertices first.','Calculate each edge slope from its two vertices.','Use the edge x-values as the domain.'],'Example: a roof through (-3,0),(0,3),(3,0) uses y=x+3;[-3,0] and y=-x+3;[0,3].','Why are domains important for polygons?',['They change gravity','They stop edges at vertices','They create curves','They increase score'],1,'A polygon is many simple equations joined precisely.','polygon','|m|',.25,1.25,.25,.5),
    absolute: L('Absolute-value functions','y = a|x-h| + k','One formula creates both sides of a V. The vertex is (h,k).',[['a','steepness/sign','positive opens up, negative flips'],['h','horizontal shift','moves the vertex left/right'],['k','vertical shift','moves the vertex up/down']],['Locate the vertex (h,k).','Choose whether the V opens up or down.','Use another point to solve a.'],'Example: vertex (1,-1), point (3,1) gives a=1, so y=|x-1|-1.','What does negative a do?',['Moves right','Creates a circle','Flips the V upside down','Removes the vertex'],2,'One absolute-value formula can replace two line segments.','absolute','a',-1.5,1.5,.25,.75),
    quadratic: L('Quadratic functions','y = a(x-h)² + k','A quadratic creates a smooth parabola. Its slope changes continuously, so the ball accelerates differently at different positions.',[['a','curvature','opening direction and width'],['h','horizontal shift','moves the vertex left/right'],['k','vertical shift','moves the vertex up/down']],['Find the vertex (h,k).','Use the sign of a to choose opening direction.','Use another point to solve the width.'],'Example: vertex (0,-2), point (2,0): 0=4a-2, so a=0.5 and y=0.5x²-2.','If a is positive, the parabola opens...',['Upward','Downward','Left','As a line'],0,'a controls both opening direction and curvature.','quadratic','a',-.8,.8,.1,.3),
    circle: L('Circle equations','(x-h)² + (y-k)² = r²','A circle is every point exactly r units from centre (h,k). It can act as a curved bumper or boundary.',[['h','centre x','left/right position'],['k','centre y','up/down position'],['r','radius','circle size']],['Read the centre (h,k).','Identify radius r.','Square r on the right-hand side.'],'Example: centre (1,-1), radius 3 gives (x-1)²+(y+1)²=9.','Radius 4 means the right side is...',['4','8','16','2'],2,'The right side is radius squared.','circle','r',1,4,.5,2.5),
    semicircle: L('Semicircles and arcs','y = k ± √(r²-(x-h)²)','Solving a circle for y creates an upper or lower half. This gives bowls, halfpipes and curved exits.',[['h','centre x','horizontal position'],['k','centre y','vertical position'],['r','radius','width/depth'],['±','half','+ upper, − lower']],['Start from the circle.','Solve for y to get ±√(...).','Choose + or − and use the natural domain h-r to h+r.'],'Example: lower radius-3 semicircle: y=-√(9-x²);[-3,3].','Which sign gives the lower half?',['+√','−√','Either','No square root'],1,'The sign before √ selects the half.','semicircle','r',1.5,4.5,.5,3),
    trig: L('Sine and cosine waves','y = A sin(Bx + C) + D','Wave parameters control height, spacing and position. The ball repeatedly gains and loses speed over crests and troughs.',[['A','amplitude','wave height'],['B','frequency','wave spacing'],['C','phase','left/right shift'],['D','vertical shift','centre-line height']],['Choose A from the required peak height.','Choose B from how many waves should fit.','Use C and D only when the wave needs shifting.'],'Example: y=2sin(x)-1 has amplitude 2 and centre line y=-1.','Which parameter changes wave height?',['A','B','C only','Domain only'],0,'Amplitude changes height; frequency changes spacing.','trig','A',.5,3,.25,1.5),
    sqrt: L('Square-root functions','y = a√(x-h) + k','A square-root graph has a clear starting point and then bends gradually, creating a one-sided ramp.',[['a','stretch/flip','steepness and direction'],['h','start x','horizontal start'],['k','start y','vertical start']],['Find the start point (h,k).','Write √(x-h) so the graph starts at x=h.','Use a for direction and steepness.'],'Example: y=√(x+2)-1 starts at (-2,-1).','What does h mainly control?',['The starting x-position','Gravity','Radius','Number of stars'],0,'The graph starts where the root expression becomes zero.','sqrt','a',-2,2,.25,1),
    cubic: L('Cubic functions','y = a(x-h)³ + k','A cubic creates a smooth S-curve with an inflection point.',[['a','strength/sign','steepness and direction'],['h','inflection x','horizontal centre'],['k','inflection y','vertical centre']],['Choose the inflection point.','Choose the sign of a.','Start with a small |a| because cubics grow quickly.'],'Example: y=0.05x³ is gentle near x=0 and much steeper farther away.','Why use small cubic coefficients?',['Cubics grow quickly away from centre','They remove gravity','They become circles','They prevent domains'],0,'Cubics change curvature smoothly at the inflection point.','cubic','a',-.15,.15,.025,.06),
    exponential: L('Exponential functions','y = a·b^(x-h) + k','Exponentials multiply by a constant factor for equal x-steps, so their slope can change very quickly.',[['a','scale','overall height'],['b','base','growth or decay'],['h','horizontal shift','left/right position'],['k','vertical shift','asymptote height']],['Decide growth or decay.','Use b>1 for growth or 0<b<1 for decay.','Use a,h,k to fit the route.'],'Example: 3(0.5)^x halves the exponential part for every +1 in x.','Which base gives decay?',['2','1.5','0.6','-2'],2,'The base decides growth versus decay.','exponential','b',.35,1.8,.05,.7),
    reciprocal: L('Reciprocal functions','y = a/(x-h) + k','A reciprocal has two branches separated by an asymptote, showing that some x-values are forbidden.',[['a','scale/orientation','branch spacing and direction'],['h','vertical asymptote','forbidden x-value'],['k','horizontal asymptote','long-run y-value']],['Find the forbidden x-value h.','Place the horizontal asymptote with k.','Use a to control orientation and spacing.'],'Example: y=2/(x-1) has vertical asymptote x=1.','For y=2/(x-3), the vertical asymptote is...',['x=-3','y=3','x=3','x=2'],2,'The denominator tells you where the graph cannot exist.','reciprocal','a',-3,3,.5,1.5),
    mixed: L('Mixed-function engineering','combine different formula families','Advanced routes are easier when you solve them section by section and choose the right function family for each shape.',[['family','shape choice','choose the best formula per section'],['domain','handoff point','where one section ends'],['continuity','smooth transfer','matching endpoints improves handoff']],['Break the course into sections.','Choose the simplest family for each section.','Match endpoints and test one transfer at a time.'],'Example: quadratic bowl → sine terrain → square-root exit.','Best way to debug a mixed course?',['Change everything at once','Fix one section or handoff at a time','Remove domains','Replace curves with lines'],1,'Solve complex routes one section at a time.','mixed','wave amount',0,1.5,.25,.5)
  };

  function L(title, formula, intro, vars, steps, example, q, options, correct, takeaway, graph, control, min, max, inc, initial) {
    return {title, formula, intro, vars, steps, example, check:{q,options,correct}, takeaway, graph, explore:{control,min,max,inc,initial}};
  }
  const lessonFor = (l) => S[keyFor(l)] || S.linear;

  function renderReference() {
    const l = currentLevel(), s = lessonFor(l);
    ref.innerHTML = `<div class="formula-reference-top"><div><span>Formula reference</span><strong>${esc(s.title)}</strong></div><button type="button">Learn</button></div><code>${esc(s.formula)}</code><div class="reference-vars">${s.vars.slice(0,3).map(v=>`<span><b>${esc(v[0])}</b>${esc(v[1])}</span>`).join('')}</div>`;
    ref.querySelector('button')?.addEventListener('click', () => reviewBtn.click());
  }

  function prepare() {
    const l = currentLevel(), concept = keyFor(l);
    active = {l, concept, s: lessonFor(l), full: !saved.mastered[concept]};
    step = 0; answer = null; upgradedLevel = l.id;
    card.classList.add('guided-mode'); course.classList.remove('hidden'); render();
  }
  const stages = () => active.full ? ['concept','explore','worked','check','ready'] : ['recap','check','ready'];

  function render() {
    const st = stages(), mode = st[step], s = active.s;
    course.innerHTML = `<div class="guided-head"><div><span class="guided-kicker">${active.full?'Concept lesson':'Mission refresher'} · ${esc(active.l.family||'')}</span><h2>${esc(s.title)}</h2></div><div class="guided-progress">${st.map((_,i)=>`<span class="${i<step?'done':i===step?'active':''}">${i+1}</span>`).join('')}</div></div><div id="guidedBody"></div>`;
    const body = $('#guidedBody');
    if (mode==='concept'||mode==='recap') concept(body,s,mode==='recap');
    if (mode==='explore') explore(body,s);
    if (mode==='worked') worked(body,s);
    if (mode==='check') check(body,s);
    if (mode==='ready') ready(body,s,active.l);
    overlay.querySelector('.lesson-footer p').textContent = mode==='check'?'A correct answer unlocks the challenge.':mode==='ready'?'Now apply the idea without copying an answer.':'Understand what the formula does before using it.';
    startBtn.textContent = mode==='check'?'Check answer →':mode==='ready'?'Start challenge →':`Continue ${step+1}/${st.length} →`;
  }

  function concept(body,s,compact){
    body.innerHTML=`<div class="guided-concept-grid ${compact?'compact':''}"><div class="guided-copy-block"><span class="guided-label">What this means</span><p class="guided-intro">${esc(s.intro)}</p><div class="guided-formula"><span>Core formula</span><code>${esc(s.formula)}</code></div><div class="physics-link"><b>Why it matters in the game</b><p>${esc(physicsLink(active.concept))}</p></div></div><div class="variable-board"><span class="guided-label">What each part controls</span>${s.vars.map(v=>`<div class="variable-row"><b>${esc(v[0])}</b><div><strong>${esc(v[1])}</strong><p>${esc(v[2])}</p></div></div>`).join('')}</div></div>`;
  }
  function explore(body,s){
    const e=s.explore; body.innerHTML=`<div class="explore-layout"><div><span class="guided-label">Explore it</span><h3>Change ${esc(e.control)} and watch the graph</h3><p>Move the control slowly. Notice exactly what changes and what stays fixed.</p><div class="explore-control"><div><span>${esc(e.control)}</span><strong id="exploreValue"></strong></div><input id="exploreSlider" type="range" min="${e.min}" max="${e.max}" step="${e.inc}" value="${e.initial}"></div><div class="explore-observe"><b>Observe:</b> ${esc(observe(active.concept))}</div></div><div class="learning-graph-card"><canvas id="learningGraph" width="560" height="300"></canvas></div></div>`;
    const slider=$('#exploreSlider'), redraw=()=>{const v=Number(slider.value);$('#exploreValue').textContent=fmt(v);draw($('#learningGraph'),s.graph,v)}; slider.addEventListener('input',redraw); redraw();
  }
  function worked(body,s){body.innerHTML=`<div class="worked-layout"><div><span class="guided-label">Worked example</span><h3>How to build the equation</h3><div class="worked-steps">${s.steps.map((x,i)=>`<div><span>${i+1}</span><p>${esc(x)}</p></div>`).join('')}</div></div><div class="worked-answer"><span>Example reasoning</span><p>${esc(s.example)}</p><div class="worked-rule"><b>Remember</b><p>${esc(s.takeaway)}</p></div></div></div>`}
  function check(body,s){body.innerHTML=`<div class="quick-check"><span class="guided-label">Quick check</span><h3>${esc(s.check.q)}</h3><p class="check-sub">Choose an answer before starting the mission.</p><div class="check-options">${s.check.options.map((o,i)=>`<button type="button" data-choice="${i}" class="${answer===i?'selected':''}"><span>${String.fromCharCode(65+i)}</span>${esc(o)}</button>`).join('')}</div><div id="checkFeedback" class="check-feedback"></div></div>`;body.querySelectorAll('[data-choice]').forEach(b=>b.addEventListener('click',()=>{answer=Number(b.dataset.choice);body.querySelectorAll('[data-choice]').forEach(x=>x.classList.toggle('selected',x===b));$('#checkFeedback').textContent=''}))}
  function ready(body,s,l){body.innerHTML=`<div class="ready-panel"><div class="ready-check">✓</div><span class="guided-label">Concept checked</span><h3>Now apply it yourself</h3><p>${esc(s.takeaway)}</p><div class="ready-mission"><span>Your mission</span><strong>${esc(l.title)}</strong><p>${esc(l.description||'')}</p></div><div class="ready-rules"><span>1</span>Write it <span>2</span>See the graph <span>3</span>Test it <span>4</span>Learn from feedback</div></div>`}

  startBtn.addEventListener('click',(e)=>{
    if(!active||overlay.classList.contains('hidden')||course.classList.contains('hidden')) return;
    const st=stages(), mode=st[step];
    if(mode==='ready'){saved.mastered[active.concept]=true;saved.seen[active.l.id]=true;persist();active=null;course.classList.add('hidden');card.classList.remove('guided-mode');renderReference();return}
    e.preventDefault();e.stopImmediatePropagation();
    if(mode==='check'){
      const f=$('#checkFeedback');
      if(answer===null){f.textContent='Choose an answer first.';return}
      if(answer!==active.s.check.correct){f.textContent=`Not quite. ${active.s.takeaway} Try again.`;f.dataset.state='wrong';return}
      saved.mastered[active.concept]=true;persist();
    }
    step=Math.min(step+1,st.length-1);answer=null;render();
  },true);

  const upgrade=()=>{if(overlay.classList.contains('hidden'))return;const l=currentLevel();if(!active||upgradedLevel!==l.id)prepare()};
  new MutationObserver(()=>{if(!overlay.classList.contains('hidden'))setTimeout(upgrade,0);else{active=null;course.classList.add('hidden');card.classList.remove('guided-mode')}}).observe(overlay,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>{renderReference();coach.classList.add('hidden');schedule()}).observe($('#missionTitle'),{childList:true,subtree:true});
  new MutationObserver(updateCoach).observe(statusEl,{childList:true,subtree:true,attributes:true,attributeFilter:['data-type']});

  function schedule(){clearTimeout(schedule.t);schedule.t=setTimeout(()=>{const l=currentLevel(),k=keyFor(l);if(saved.mastered[k])return;if(!overlay.classList.contains('hidden'))return upgrade();reviewBtn.click();setTimeout(upgrade,20)},180)}
  function updateCoach(){if(statusEl.dataset.type!=='warn'){coach.classList.add('hidden');return}const k=keyFor(currentLevel()),a=coachFor(k,/run ended|stars|basket|ball/i.test(statusEl.textContent));coach.innerHTML=`<div class="coach-icon">∑</div><div class="coach-copy"><span>Math Coach · learn from this attempt</span><strong>${esc(a.title)}</strong><p>${esc(a.body)}</p><div class="coach-checks">${a.checks.map(x=>`<span>• ${esc(x)}</span>`).join('')}</div></div><button type="button">Review concept</button>`;coach.querySelector('button').addEventListener('click',()=>reviewBtn.click());coach.classList.remove('hidden')}
  function coachFor(k,physics){const checks={horizontal:['Check the y-value.','Check the domain.'],vertical:['Check the x-value.','Check the vertical range.'],linear:['Check slope m first.','Then intercept c.','Then the domain.'],domain:['Check start/end x-values.','Look for gaps or overlaps.'],polygon:['Check each vertex.','Make neighbouring endpoints meet.'],absolute:['Check vertex (h,k).','Check sign and size of a.'],quadratic:['Check the vertex.','Check the sign of a.','Change one coefficient at a time.'],circle:['Check centre (h,k).','Remember r² on the right.'],semicircle:['Check +√ vs −√.','Check radius and domain.'],trig:['Check amplitude A.','Check frequency B.','Check vertical/downhill shift.'],sqrt:['Check the starting point.','Check a and the root direction.'],cubic:['Check the inflection point.','Use a small coefficient first.'],exponential:['Check growth vs decay base.','Then scale and shifts.'],reciprocal:['Check asymptote x=h.','Avoid the forbidden x-value.'],mixed:['Find the exact failing section.','Change one handoff at a time.']}[k]||['Check the formula family.','Change one parameter at a time.'];return{title:physics?'The ball is giving you mathematical feedback.':'Compare the graph, not just the formula text.',body:physics?'Watch where the ball loses contact, misses a star or reaches the wrong height. That location tells you which parameter or domain needs changing.':'A near match usually means the family is correct but one parameter, sign or endpoint is wrong.',checks}}

  function physicsLink(k){return {horizontal:'A flat platform has no downhill gravity component, so the ball keeps only the momentum it already has.',vertical:'Vertical equations are boundaries rather than ordinary rideable y(x) ramps.',linear:'Steeper downhill slope gives gravity a larger component along the surface.',domain:'When the domain ends, the surface ends and the ball enters free fall.',polygon:'Each vertex is a transfer between slopes; accurate endpoints make the transfer predictable.',absolute:'The V vertex changes slope instantly using one formula.',quadratic:'Slope changes continuously along a parabola, so acceleration changes continuously too.',circle:'The surface normal changes all around the circle, redirecting velocity.',semicircle:'A halfpipe converts height into speed near the bottom and speed back into height.',trig:'Crests slow climbs and troughs speed descents repeatedly.',sqrt:'The curve begins at one point and gradually flattens.',cubic:'The S-curve changes concavity at its inflection point.',exponential:'Slope can change very quickly, so small parameter changes matter a lot.',reciprocal:'The asymptote creates a forbidden region where the function is undefined.',mixed:'Different families create different physical behaviour; the challenge is making the handoffs work.'}[k]||'The graph is also a physical surface, so changing the equation changes the motion.'}
  function observe(k){return {horizontal:'the line moves without tilting.',vertical:'the line moves left and right.',linear:'the angle changes around the same intercept.',domain:'the same line exists over a longer or shorter interval.',polygon:'the two sides become steeper or flatter.',absolute:'the V gets steeper, flatter or flips.',quadratic:'the parabola widens, narrows or flips.',circle:'the radius changes while the centre stays fixed.',semicircle:'the bowl becomes wider/deeper as radius grows.',trig:'the peak and trough height changes.',sqrt:'the one-sided curve stretches or flips.',cubic:'the S-curve strengthens or reverses.',exponential:'growth/decay changes as the base crosses 1.',reciprocal:'branches move while the asymptotes stay fixed.',mixed:'one component becomes more visible while the base curve remains.'}[k]||'the graph changes.'}

  function draw(canvas,type,v){if(!canvas)return;const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,X=x=>(x+5)/10*w,Y=y=>h-(y+4)/8*h;c.clearRect(0,0,w,h);c.fillStyle='#fff';c.fillRect(0,0,w,h);for(let x=-5;x<=5;x++){c.beginPath();c.moveTo(X(x),0);c.lineTo(X(x),h);c.strokeStyle=x===0?'#9fb9b4':'#e5eeec';c.stroke()}for(let y=-4;y<=4;y++){c.beginPath();c.moveTo(0,Y(y));c.lineTo(w,Y(y));c.strokeStyle=y===0?'#9fb9b4':'#e5eeec';c.stroke()}c.strokeStyle='#178c82';c.lineWidth=4;c.lineJoin='round';c.lineCap='round';c.beginPath();if(type==='vertical'){c.moveTo(X(v),Y(-4));c.lineTo(X(v),Y(4));c.stroke();return}if(type==='circle'){c.arc(X(0),Y(0),Math.abs(X(v)-X(0)),0,Math.PI*2);c.stroke();return}let on=false,prev=null;for(let i=0;i<=420;i++){const x=-5+10*i/420,y=demo(type,x,v);if(!Number.isFinite(y)||y<-5||y>5||(prev!==null&&Math.abs(y-prev)>1.5)){on=false;prev=y;continue}if(!on){c.moveTo(X(x),Y(y));on=true}else c.lineTo(X(x),Y(y));prev=y}c.stroke()}
  function demo(t,x,v){if(t==='horizontal')return v;if(t==='linear')return v*x+.5;if(t==='domain')return x>=-4&&x<=v?-.5*x+1:NaN;if(t==='polygon')return Math.abs(x)<=3?-Math.abs(v)*Math.abs(x)+Math.abs(v)*3:NaN;if(t==='absolute')return v*Math.abs(x)-1;if(t==='quadratic')return v*x*x-1;if(t==='semicircle')return Math.abs(x)<=v?-Math.sqrt(Math.max(0,v*v-x*x)):NaN;if(t==='trig')return v*Math.sin(x);if(t==='sqrt')return x>=-2?v*Math.sqrt(x+2)-1:NaN;if(t==='cubic')return v*x*x*x;if(t==='exponential')return 1.3*Math.pow(Math.max(.05,v),x)-1.5;if(t==='reciprocal')return Math.abs(x-.5)>.08?v/(x-.5):NaN;if(t==='mixed')return .12*x*x-1.2+v*Math.sin(x);return -.5*x+.5}
  const fmt=v=>Math.abs(v)<1e-9?'0':Number(v).toFixed(Math.abs(v)<1?2:1).replace(/\.0$/,'').replace(/0$/,'');

  renderReference(); updateCoach(); upgrade(); schedule();
})();
