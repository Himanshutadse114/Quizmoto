(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#gameCanvas');
  const ctx = canvas.getContext('2d');

  const { FAMILY, chapters, levels, fmt } = window.MathFlowContent;

  const STORAGE_KEY = 'mathFlowGeometryQuest.v1';
  let saved = loadProgress();
  let currentLevelIndex = Math.max(0, Math.min(levels.length-1, saved.lastLevel || 0));
  let currentChapter = levels[currentLevelIndex].chapter;
  let params = {};
  let attempts = 0;
  let hinted = false;
  let animFrame = null;
  let isAnimating = false;

  function loadProgress(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {completed:{}, xp:0, streak:0, lastLevel:0};
    } catch { return {completed:{}, xp:0, streak:0, lastLevel:0}; }
  }

  function persist(){
    saved.lastLevel = currentLevelIndex;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {}
  }

  function init(){
    renderChapters();
    bindEvents();
    loadLevel(currentLevelIndex);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function bindEvents(){
    $('#runBtn').addEventListener('click', runMission);
    $('#mobileRunBtn').addEventListener('click', runMission);
    $('#hintBtn').addEventListener('click', useHint);
    $('#mobileHintBtn').addEventListener('click', useHint);
    $('#resetBtn').addEventListener('click', () => loadLevel(currentLevelIndex, true));
    $('#nextBtn').addEventListener('click', nextMission);
    $('#replayBtn').addEventListener('click', () => { hideModal('#missionModal'); loadLevel(currentLevelIndex,true); });
    $('#vaultBtn').addEventListener('click', openVault);
    $('#closeVaultBtn').addEventListener('click', () => hideModal('#vaultModal'));
    $('#homeBtn').addEventListener('click', () => { document.querySelector('.chapter-nav').scrollIntoView({behavior:'smooth'}); });
    $('#formulaInfoBtn').addEventListener('click', () => toast(levels[currentLevelIndex].goal));
    $('#missionModal').addEventListener('click', e => { if(e.target.id==='missionModal') hideModal('#missionModal'); });
    $('#vaultModal').addEventListener('click', e => { if(e.target.id==='vaultModal') hideModal('#vaultModal'); });
  }

  function renderChapters(){
    const list = $('#chapterList');
    list.innerHTML = '';
    chapters.forEach((ch,i)=>{
      const num=i+1;
      const chapterLevels = levels.filter(l=>l.chapter===num);
      const done = chapterLevels.filter(l=>saved.completed[l.id]).length;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='chapter-btn'+(num===currentChapter?' active':'');
      btn.innerHTML=`<span class="chapter-num">${String(num).padStart(2,'0')}</span><span class="chapter-copy"><strong>${ch.name}</strong><small>${ch.subtitle}</small></span><span class="chapter-progress">${done}/${chapterLevels.length}</span>`;
      btn.addEventListener('click',()=>{
        const idx=levels.findIndex(l=>l.chapter===num && !saved.completed[l.id]);
        currentChapter=num;
        currentLevelIndex=idx>=0?idx:levels.findIndex(l=>l.chapter===num);
        renderChapters();
        loadLevel(currentLevelIndex);
      });
      list.appendChild(btn);
    });
    const completedCount = Object.keys(saved.completed).filter(k=>saved.completed[k]).length;
    $('#progressText').textContent=`${completedCount}/${levels.length}`;
  }

  function loadLevel(index, reset=false){
    if(animFrame){ cancelAnimationFrame(animFrame); animFrame=null; }
    isAnimating=false;
    currentLevelIndex=Math.max(0,Math.min(levels.length-1,index));
    const level=levels[currentLevelIndex];
    currentChapter=level.chapter;
    attempts=0;
    hinted=false;
    params={};
    if(level.type==='curve') params={...level.start};
    $('#missionEyebrow').textContent=`WORLD ${level.chapter} · MISSION ${String(level.id).padStart(2,'0')}`;
    $('#missionTitle').textContent=level.title;
    $('#missionDescription').textContent=level.description;
    $('#formulaDisplay').textContent=level.type==='curve'?FAMILY[level.family].formula(params):level.formula;
    $('#learningGoal').textContent=level.goal;
    $('#keyLesson').innerHTML=`<strong>KEY IDEA</strong><br>${level.type==='curve'?FAMILY[level.family].lesson:level.goal}`;
    $('#hintText').textContent=level.hint;
    $('#hintBox').classList.add('hidden');
    $('#attemptPill').textContent='0 attempts';
    $('#canvasNote').textContent=level.type==='curve'?'Tune the formula, then launch the orb.':'Choose the formula answer that completes the mission.';
    updateMissionStars();
    updateHud();
    renderChapters();
    if(level.type==='curve'){
      $('#quizCard').classList.add('hidden');
      canvas.classList.remove('hidden');
      $('#curveControls').classList.remove('hidden');
      $('#runBtn').textContent='Test Run';
      $('#mobileRunBtn').textContent='Test Run';
      renderCurveControls();
      drawBoard();
    } else {
      canvas.classList.add('hidden');
      $('#quizCard').classList.remove('hidden');
      $('#curveControls').classList.add('hidden');
      $('#runBtn').textContent='Check Answer';
      $('#mobileRunBtn').textContent='Check Answer';
      renderQuiz();
    }
    if(reset) toast('Mission reset');
    persist();
  }

  function updateHud(){
    $('#xpValue').textContent=saved.xp||0;
    $('#streakValue').textContent=saved.streak||0;
    const hearts=Math.max(0,3-Math.min(3,attempts));
    $('#heartsValue').textContent='♥ '.repeat(hearts)+'♡ '.repeat(3-hearts);
    $('#heartsValue').setAttribute('aria-label',`${hearts} hearts`);
  }

  function updateMissionStars(){
    const data=saved.completed[levels[currentLevelIndex].id];
    const stars=data?.stars||0;
    $('#missionStars').textContent='★ '.repeat(stars)+'☆ '.repeat(3-stars);
  }

  function renderCurveControls(){
    const level=levels[currentLevelIndex];
    const family=FAMILY[level.family];
    const wrap=$('#curveControls');
    wrap.innerHTML='';
    family.params.forEach(def=>{
      const row=document.createElement('div');
      row.className='param-row';
      row.innerHTML=`<div class="param-head"><label for="param_${def.key}">${def.label}</label><output id="out_${def.key}">${fmt(params[def.key])}</output></div><input id="param_${def.key}" type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${params[def.key]}">`;
      const input=row.querySelector('input');
      input.addEventListener('input',()=>{
        params[def.key]=Number(input.value);
        row.querySelector('output').textContent=fmt(params[def.key]);
        $('#formulaDisplay').textContent=family.formula(params);
        drawBoard();
      });
      wrap.appendChild(row);
    });
  }

  function renderQuiz(){
    const level=levels[currentLevelIndex];
    $('#quizPrompt').textContent=level.prompt;
    $('#quizDiagram').textContent=level.formula;
    $('#quizFeedback').textContent='';
    const options=$('#quizOptions');
    options.innerHTML='';
    level.options.forEach((opt,i)=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='quiz-option';
      btn.textContent=opt;
      btn.dataset.index=i;
      btn.addEventListener('click',()=>selectQuizAnswer(i));
      options.appendChild(btn);
    });
  }

  function selectQuizAnswer(i){
    const options=[...document.querySelectorAll('.quiz-option')];
    options.forEach(o=>o.classList.remove('selected'));
    options[i].classList.add('selected');
    options.forEach(o=>o.dataset.selected='false');
    options[i].dataset.selected='true';
    $('#quizFeedback').textContent='Answer selected. Press Check Answer.';
  }

  function runMission(){
    const level=levels[currentLevelIndex];
    if(level.type==='quiz') runQuiz(); else runCurve();
  }

  function runQuiz(){
    const level=levels[currentLevelIndex];
    const selected=document.querySelector('.quiz-option[data-selected="true"]');
    if(!selected){ toast('Choose an answer first'); return; }
    attempts++;
    updateAttemptUi();
    const idx=Number(selected.dataset.index);
    const options=[...document.querySelectorAll('.quiz-option')];
    if(idx===level.correct){
      selected.classList.add('correct');
      $('#quizFeedback').textContent=level.explanation;
      options.forEach(b=>b.disabled=true);
      setTimeout(()=>completeMission(calculateStars()),420);
    } else {
      selected.classList.add('wrong');
      $('#quizFeedback').textContent='Not quite. Re-read the formula and try again.';
      saved.streak=0;
      updateHud();
    }
  }

  function runCurve(){
    if(isAnimating) return;
    attempts++;
    updateAttemptUi();
    const level=levels[currentLevelIndex];
    const fam=FAMILY[level.family];
    const starXs=getStarXs(level);
    const starYs=starXs.map(x=>FAMILY[level.family].fn(x,level.target));
    const collected=new Set();
    let start=null;
    isAnimating=true;

    const duration=2200;
    const animate=(ts)=>{
      if(!start) start=ts;
      const t=Math.min(1,(ts-start)/duration);
      const x=level.xMin+(level.xMax-level.xMin)*t;
      const y=fam.fn(x,params);
      drawBoard({ball:{x,y},collected});
      if(y!=null && Number.isFinite(y)){
        starXs.forEach((sx,i)=>{
          const sy=starYs[i];
          if(sy!=null && Math.hypot(x-sx,y-sy)<.42) collected.add(i);
        });
      }
      if(t<1){ animFrame=requestAnimationFrame(animate); }
      else {
        isAnimating=false;
        const quality=curveQuality(level);
        const targetEnd=fam.fn(level.xMax,level.target);
        const playerEnd=fam.fn(level.xMax,params);
        const goalOk=targetEnd!=null && playerEnd!=null && Math.abs(targetEnd-playerEnd)<.65;
        if(collected.size===3 && goalOk && quality>.84){
          setTimeout(()=>completeMission(calculateStars()),240);
        } else {
          saved.streak=0;
          updateHud();
          const msg=collected.size<3?`Collected ${collected.size}/3 stars. Adjust the formula and retry.`:'The portal alignment is still off. Fine-tune your parameters.';
          toast(msg);
          $('#canvasNote').textContent=msg;
        }
      }
    };
    animFrame=requestAnimationFrame(animate);
  }

  function updateAttemptUi(){
    $('#attemptPill').textContent=`${attempts} attempt${attempts===1?'':'s'}`;
    updateHud();
  }

  function curveQuality(level){
    const fam=FAMILY[level.family];
    let good=0,total=0;
    for(let i=0;i<=30;i++){
      const x=level.xMin+(level.xMax-level.xMin)*(i/30);
      const a=fam.fn(x,params), b=fam.fn(x,level.target);
      if(a==null||b==null||!Number.isFinite(a)||!Number.isFinite(b)) continue;
      total++;
      if(Math.abs(a-b)<.7) good++;
    }
    return total?good/total:0;
  }

  function calculateStars(){
    if(attempts<=1 && !hinted) return 3;
    if(attempts<=2 && !hinted) return 2;
    return 1;
  }

  function completeMission(stars){
    const level=levels[currentLevelIndex];
    const previous=saved.completed[level.id];
    const gainedXp=previous?0:100+stars*20;
    const bestStars=Math.max(previous?.stars||0,stars);
    saved.completed[level.id]={stars:bestStars};
    saved.xp=(saved.xp||0)+gainedXp;
    saved.streak=(saved.streak||0)+1;
    persist();
    updateHud();
    renderChapters();
    updateMissionStars();
    $('#modalStars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
    $('#modalXp').textContent=gainedXp?`+${gainedXp}`:'BEST SAVED';
    $('#modalTitle').textContent=`${level.title} mastered`;
    $('#modalText').textContent=level.type==='curve'?`You turned ${FAMILY[level.family].formula(params)} into a working path. ${FAMILY[level.family].lesson}`:level.explanation;
    $('#nextBtn').textContent=currentLevelIndex===levels.length-1?'Finish Quest':'Next Mission';
    showModal('#missionModal');
  }

  function nextMission(){
    hideModal('#missionModal');
    if(currentLevelIndex<levels.length-1) loadLevel(currentLevelIndex+1);
    else { toast('Geometry Quest complete — Formula Vault fully unlocked!'); openVault(); }
  }

  function useHint(){
    const level=levels[currentLevelIndex];
    hinted=true;
    $('#hintBox').classList.remove('hidden');
    if(level.type==='curve'){
      const keys=Object.keys(level.target);
      if(keys.length){
        const key=keys[0];
        params[key]=level.target[key];
        const input=$(`#param_${key}`);
        const out=$(`#out_${key}`);
        if(input){ input.value=params[key]; out.textContent=fmt(params[key]); }
        $('#formulaDisplay').textContent=FAMILY[level.family].formula(params);
        drawBoard();
      }
    }
    toast('Hint used — one parameter clue revealed');
  }

  function getStarXs(level){
    if(level.family==='sqrt') return [-3.2,.2,3.8];
    if(level.family==='reciprocal') return [-4,-2.2,2.6];
    return [-3.7,0,3.5];
  }

  function resizeCanvas(){
    const rect=canvas.getBoundingClientRect();
    if(!rect.width) return;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(rect.width*ratio);
    canvas.height=Math.round(rect.width*(620/1000)*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    drawBoard();
  }

  function drawBoard(extra={}){
    const level=levels[currentLevelIndex];
    if(!level || level.type!=='curve' || canvas.classList.contains('hidden')) return;
    const w=canvas.getBoundingClientRect().width || 900;
    const h=w*(620/1000);
    ctx.clearRect(0,0,w,h);
    const map={xMin:-6,xMax:6,yMin:-5,yMax:5};
    const sx=x=>((x-map.xMin)/(map.xMax-map.xMin))*w;
    const sy=y=>h-((y-map.yMin)/(map.yMax-map.yMin))*h;

    ctx.fillStyle='#080820';
    ctx.fillRect(0,0,w,h);
    ctx.lineWidth=1;
    for(let x=-6;x<=6;x++){
      ctx.strokeStyle=x===0?'rgba(255,255,255,.22)':'rgba(255,255,255,.07)';
      ctx.beginPath();
      ctx.moveTo(sx(x),0);
      ctx.lineTo(sx(x),h);
      ctx.stroke();
    }
    for(let y=-5;y<=5;y++){
      ctx.strokeStyle=y===0?'rgba(255,255,255,.22)':'rgba(255,255,255,.07)';
      ctx.beginPath();
      ctx.moveTo(0,sy(y));
      ctx.lineTo(w,sy(y));
      ctx.stroke();
    }
    ctx.fillStyle='rgba(155,163,197,.75)';
    ctx.font='10px system-ui';
    for(let x=-5;x<=5;x+=2) ctx.fillText(String(x),sx(x)+4,sy(0)+13);
    for(let y=-4;y<=4;y+=2) if(y!==0) ctx.fillText(String(y),sx(0)+5,sy(y)-4);

    drawFunction(FAMILY[level.family].fn,level.target,'rgba(157,124,255,.22)',2,true);
    drawFunction(FAMILY[level.family].fn,params,'#4ce6f3',3,false);

    const starXs=getStarXs(level);
    starXs.forEach((x,i)=>{
      const y=FAMILY[level.family].fn(x,level.target);
      if(y==null) return;
      drawStar(sx(x),sy(y),extra.collected?.has(i));
    });

    const gy=FAMILY[level.family].fn(level.xMax,level.target);
    if(gy!=null){
      ctx.strokeStyle='#57e39b';
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(sx(level.xMax),sy(gy),14,0,Math.PI*2);
      ctx.stroke();
      ctx.fillStyle='rgba(87,227,155,.16)';
      ctx.fill();
    }

    if(extra.ball && extra.ball.y!=null && Number.isFinite(extra.ball.y)){
      const bx=sx(extra.ball.x), by=sy(extra.ball.y);
      const grd=ctx.createRadialGradient(bx-3,by-4,2,bx,by,13);
      grd.addColorStop(0,'#fff');
      grd.addColorStop(.2,'#ffd65a');
      grd.addColorStop(1,'#ff5ca8');
      ctx.fillStyle=grd;
      ctx.beginPath();
      ctx.arc(bx,by,10,0,Math.PI*2);
      ctx.fill();
    }

    function drawFunction(fn,p,color,width,dashed){
      ctx.save();
      ctx.strokeStyle=color;
      ctx.lineWidth=width;
      ctx.setLineDash(dashed?[7,6]:[]);
      ctx.beginPath();
      let pen=false;
      for(let i=0;i<=260;i++){
        const x=map.xMin+(map.xMax-map.xMin)*(i/260);
        const y=fn(x,p);
        if(y==null||!Number.isFinite(y)||y<map.yMin-2||y>map.yMax+2){ pen=false; continue; }
        if(!pen){ ctx.moveTo(sx(x),sy(y)); pen=true; }
        else ctx.lineTo(sx(x),sy(y));
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawStar(x,y,collected){
    ctx.save();
    ctx.translate(x,y);
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const r=i%2===0?10:4.5;
      const a=-Math.PI/2+i*Math.PI/5;
      const px=Math.cos(a)*r, py=Math.sin(a)*r;
      i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.fillStyle=collected?'#57e39b':'#ffd65a';
    ctx.fill();
    ctx.restore();
  }

  function openVault(){
    const grid=$('#vaultGrid');
    grid.innerHTML='';
    levels.forEach((level,i)=>{
      const unlocked=i===0 || !!saved.completed[level.id] || !!saved.completed[levels[Math.max(0,i-1)].id];
      const formula=level.type==='curve'?FAMILY[level.family].formula(level.target):level.formula;
      const item=document.createElement('div');
      item.className='vault-item'+(unlocked?'':' locked');
      item.innerHTML=`<span>${unlocked?`MISSION ${level.id}`:'LOCKED'}</span><strong>${unlocked?formula:'???'}</strong><p>${unlocked?(level.type==='curve'?FAMILY[level.family].lesson:level.goal):'Complete earlier missions to reveal this formula.'}</p>`;
      grid.appendChild(item);
    });
    showModal('#vaultModal');
  }

  function showModal(sel){ $(sel).classList.remove('hidden'); }
  function hideModal(sel){ $(sel).classList.add('hidden'); }

  let toastTimer;
  function toast(msg){
    const el=$('#toast');
    el.textContent=msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),2600);
  }

  init();
})();
