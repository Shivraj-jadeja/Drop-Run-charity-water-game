// ---- Elements
const views = { home: byId('home'), game: byId('game'), results: byId('results') };
const btn = {
  play: byId('playBtn'), how: byId('howBtn'), closeHow: byId('closeHow'),
  again: byId('againBtn'), homeResults: byId('homeResultsBtn'), share: byId('shareBtn'),
  pause: byId('pauseBtn'), resume: byId('resumeBtn'), home: byId('homeBtn')
};
const modals = { how: byId('howModal'), pause: byId('pauseModal') };
const playArea = byId('playArea');
const player = byId('player');
const scoreEl = byId('score');
const livesEl = byId('lives');
const impactFill = byId('impactFill');
const factTitle = byId('factTitle');
const factBody  = byId('factBody');
const confettiLayer = byId('confetti');
const resultTitle = byId('resultTitle');
const difficultySelect = byId('difficulty');
const milestoneBanner = byId('milestoneBanner');

// ---- AUDIO
const sfx = {
  collect: byId('sfx-collect'), // good item
  bad:     byId('sfx-bad'),     // bad item
  over:    byId('sfx-over'),    // game over (lose)
  win:     byId('sfx-win'),     // level complete (win)
  music:   byId('music'),       // background loop
};
// recommended default volumes (tweak as you like)
if (sfx.music)  sfx.music.volume = 0.25;
if (sfx.collect) sfx.collect.volume = 0.7;
if (sfx.bad)     sfx.bad.volume = 0.7;
if (sfx.win)     sfx.win.volume = 0.8;
if (sfx.over)    sfx.over.volume = 0.8;

// ---- Difficulty
const DIFFICULTY = {
  easy:   { timer: 70, spawnGap: 1000, speed: 110 },
  normal: { timer: 60, spawnGap: 900,  speed: 120 },
  hard:   { timer: 45, spawnGap: 720,  speed: 135 },
};
const MILESTONES = [5, 10, 15, 20];
let _milestonesShown = new Set();

// ---- ITEMS (exact set requested)
const GOOD_ITEMS = [
  {icon:"img:./img/jerrycan.png", points:10, impact:5, alt:"jerry can"},
  {icon:"✨", points:8,  impact:4, alt:"sparkles"},
  {icon:"♻️", points:6,  impact:3, alt:"recycle"},
];
const BAD_ITEMS = [
  {icon:"🛢️", points:-10, impact:0, alt:"oil barrel"},
  {icon:"💥", points:-12,  impact:0, alt:"explosion"},
  {icon:"⚠️", points:-8,   impact:0, alt:"warning"},
];

// ---- State
let state = 'HOME';   // HOME | PLAYING | PAUSED | CELEBRATE | RESULTS
let lane = 1;         // 0..2
let lastTime = 0, rafId = 0;

let score = 0, lives = 3, impact = 0, timer = 60;
let objects = [];
let lastSpawn = 0, spawnGap = 900, speed = 120;

// ---- Utils
function byId(id){ return document.getElementById(id); }
function show(name){
  Object.keys(views).forEach(k => views[k].classList.remove('active'));
  views[name].classList.add('active');
}
function updateHUD(){
  scoreEl.textContent = score;
  livesEl.textContent = '♥'.repeat(lives);
  impactFill.style.width = `${impact}%`;
}
function setLane(n){
  lane = Math.max(0, Math.min(2, n));
  player.style.left = `calc(${(lane + 0.5) * 33.3333}% - 16px)`;
}
function showMilestone(msg){
  milestoneBanner.textContent = msg;
  milestoneBanner.style.display = 'block';
  setTimeout(()=> milestoneBanner.style.display='none', 1400);
}

// ---- Spawn
function spawn(ts){
  if (ts - lastSpawn < spawnGap) return;
  lastSpawn = ts;

  const good = Math.random() < 0.7;
  const laneIdx = Math.floor(Math.random() * 3);
  const set = good ? GOOD_ITEMS : BAD_ITEMS;
  const pick = set[Math.floor(Math.random() * set.length)];

  const el = document.createElement('div');
  el.className = 'obj';
  el.dataset.lane = String(laneIdx);
  el.dataset.y = '-20';
  el.dataset.good = good ? '1' : '0';
  el.dataset.points = String(pick.points || 0);
  el.dataset.impact = String(pick.impact || 0);

  if (typeof pick.icon === 'string' && pick.icon.startsWith('img:')){
    const img = document.createElement('img');
    img.src = pick.icon.slice(4);
    img.alt = pick.alt || '';
    el.appendChild(img);
  } else {
    el.textContent = pick.icon;
    el.setAttribute('aria-label', pick.alt || '');
  }

  const x = (playArea.clientWidth * (laneIdx + 0.5) / 3);
  el.style.left = `${x}px`;
  el.style.top = '-20px';
  playArea.appendChild(el);
  objects.push(el);
}

function step(dt){
  for (let i=objects.length-1; i>=0; i--){
    const el = objects[i];
    let y = parseFloat(el.dataset.y);
    y += speed * dt;
    el.dataset.y = String(y);
    el.style.top = y + 'px';

    const sameLane = parseInt(el.dataset.lane,10) === lane;
    const hitTop = playArea.clientHeight - 100;
    const hitBottom = playArea.clientHeight - 40;

    if (sameLane && y > hitTop && y < hitBottom) {
      const good = el.dataset.good === '1';
      const pts = parseInt(el.dataset.points, 10) || 0;
      const imp = parseInt(el.dataset.impact, 10) || 0;

      if (good) {
        score = Math.max(0, score + pts);
        impact = Math.min(100, impact + imp);
        pop(`+${pts}`);
        try { sfx.collect && sfx.collect.play(); } catch(_) {}
        for (const m of MILESTONES) {
          if (score >= m && !_milestonesShown.has(m)) {
            _milestonesShown.add(m);
            showMilestone(m >= 15 ? "So close — don’t stop!" : "Nice!");
            break;
          }
        }
      } else {
        lives = Math.max(0, lives - 1);
        score = Math.max(0, score + pts); // negative
        pop(`−1 ♥  ${pts}`);
        try { sfx.bad && sfx.bad.play(); } catch(_) {}
      }

      el.remove();
      objects.splice(i, 1);
    } else if (y > playArea.clientHeight + 40) {
      el.remove();
      objects.splice(i, 1);
    }
  }
  updateHUD();
}

// ---- Input
window.addEventListener('keydown', (e) => {
  if (state !== 'PLAYING') return;
  if (e.key === 'ArrowLeft') setLane(lane-1);
  if (e.key === 'ArrowRight') setLane(lane+1);
});

// ---- Feedback & confetti
function pop(text){
  const f = document.createElement('div');
  f.className = 'pop';
  f.style.left = player.style.left;
  f.textContent = text;
  playArea.appendChild(f);
  setTimeout(()=> f.remove(), 600);
}
function rainOnce(count = 18) {
  const w = playArea.clientWidth;
  for (let i=0; i<count; i++){
    const d = document.createElement('span');
    d.className = 'drop';
    d.textContent = '💧';
    d.style.left = Math.random() * w + 'px';
    d.style.fontSize = (18 + Math.random()*14) + 'px';
    d.style.setProperty('--dur', (1.2 + Math.random()*1.2) + 's');
    confettiLayer.appendChild(d);
    setTimeout(()=> d.remove(), 2400);
  }
}
function rainSequence(ms = 3000) {
  return new Promise(resolve => {
    const start = performance.now();
    rainOnce(26);
    const tick = () => {
      const now = performance.now();
      if (now - start < ms){
        if ((now - start) % 600 < 40) rainOnce(12);
        requestAnimationFrame(tick);
      } else resolve();
    };
    requestAnimationFrame(tick);
  });
}

// ---- Loop
function loop(ts){
  if (!lastTime) lastTime = ts;
  const dt = (ts - lastTime) / 1000;
  lastTime = ts;

  spawn(ts);
  step(dt);

  if (impact >= 100) return endRun('impact');
  timer -= dt;
  if (timer <= 0 || lives === 0) return endRun('normal');

  rafId = requestAnimationFrame(loop);
}

// ---- Audio helpers
function startMusic(){
  try { sfx.music && (sfx.music.currentTime = 0, sfx.music.play()); } catch(_) {}
}
function pauseMusic(){
  try { sfx.music && sfx.music.pause(); } catch(_) {}
}
function stopMusic(){
  try { if (sfx.music){ sfx.music.pause(); sfx.music.currentTime = 0; } } catch(_) {}
}

// ---- Run lifecycle
function startRun() {
  state = 'PLAYING';
  show('game');
  score = 0; lives = 3; impact = 0;
  _milestonesShown.clear();

  const d = DIFFICULTY[(difficultySelect&&difficultySelect.value)||'normal'] || DIFFICULTY.normal;
  timer = d.timer; lastSpawn = 0; spawnGap = d.spawnGap; speed = d.speed; lastTime = 0;

  objects.forEach(o => o.remove()); objects = [];
  confettiLayer.innerHTML = '';
  setLane(1); updateHUD();

  // Autoplay policies require user gesture; Play button triggers this.
  startMusic();

  rafId = requestAnimationFrame(loop);
}

function endRun(reason = 'normal') {
  cancelAnimationFrame(rafId);

  // Stop music immediately on end; then play outcome SFX
  stopMusic();

  if (reason === 'impact') {
    try { sfx.win && sfx.win.play(); } catch(_) {}
    state = 'CELEBRATE';
    resultTitle.textContent = 'Impact Reached! 🎉';
    factTitle.textContent = 'Great job!';
    factBody.textContent  = 'Your Impact bar hit 100%. Thanks for learning and sharing clean water facts.';
    rainSequence(3000).then(() => { state = 'RESULTS'; show('results'); });
  } else {
    try { sfx.over && sfx.over.play(); } catch(_) {}
    state = 'RESULTS';
    resultTitle.textContent = 'Run Complete!';
    const facts = [
      {title:'Pipes Matter', text:'A single pipe segment can connect a household to a clean water point for years.'},
      {title:'Filters 101',  text:'Sand & charcoal layers remove many particulates and improve taste.'},
      {title:'Time Saved',   text:'Clean water nearby can save families 1–3 hours a day.'},
    ];
    const fact = facts[Math.floor(Math.random()*facts.length)];
    factTitle.textContent = fact.title;
    factBody.textContent = fact.text;
    show('results');
  }
}

// ---- Buttons
btn.play.addEventListener('click', startRun);
btn.how.addEventListener('click', () => modals.how.showModal());
btn.closeHow.addEventListener('click', () => modals.how.close());
btn.pause.addEventListener('click', () => {
  if (state !== 'PLAYING') return;
  state = 'PAUSED';
  cancelAnimationFrame(rafId);
  pauseMusic();
  modals.pause.showModal();
});
btn.resume.addEventListener('click', () => {
  if (state !== 'PAUSED') return;
  modals.pause.close();
  state = 'PLAYING'; lastTime = 0;
  startMusic();
  rafId = requestAnimationFrame(loop);
});
btn.home.addEventListener('click', () => { modals.pause.close(); state='HOME'; show('home'); });
btn.again.addEventListener('click', startRun);
btn.homeResults.addEventListener('click', () => { state='HOME'; show('home'); });
btn.share.addEventListener('click', async () => {
  const text = `I scored ${score} in Drop Run!`;
  try { if (navigator.share) await navigator.share({title:'Drop Run', text}); else alert(text); }
  catch(_) {}
});

// ---- Init
show('home');
console.log('Drop Run ready: SFX + music wired (GOOD: jerrycan.png/✨/♻️ | BAD: 🛢️/💥/⚠️).');
