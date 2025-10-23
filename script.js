// ---- Elements
const views = {
  home: document.getElementById('home'),
  game: document.getElementById('game'),
  results: document.getElementById('results'),
};
const btn = {
  play: document.getElementById('playBtn'),
  how: document.getElementById('howBtn'),
  closeHow: document.getElementById('closeHow'),
  again: document.getElementById('againBtn'),
  homeResults: document.getElementById('homeResultsBtn'),
  share: document.getElementById('shareBtn'),
  pause: document.getElementById('pauseBtn'),
  resume: document.getElementById('resumeBtn'),
  home: document.getElementById('homeBtn'),
};
const modals = {
  how: document.getElementById('howModal'),
  pause: document.getElementById('pauseModal'),
};
const playArea = document.getElementById('playArea');
const player = document.getElementById('player');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const impactFill = document.getElementById('impactFill');
const factTitle = document.getElementById('factTitle');
const factBody  = document.getElementById('factBody');
const confettiLayer = document.getElementById('confetti');
const resultTitle = document.getElementById('resultTitle');

const FACTS = [
  {title:'Pipes Matter', text:'A single pipe segment can connect a household to a clean water point for years.'},
  {title:'Filters 101',  text:'Sand & charcoal layers remove many particulates and improve taste.'},
  {title:'Time Saved',   text:'Clean water nearby can save families 1–3 hours a day.'},
];

// --- Item sets with per-item scoring (chosen emojis)
const GOOD_ITEMS = [
  {icon:"♻️", points:15, impact:6}, // recycle
  {icon:"✨", points:10, impact:5}, // sparkle
  {icon:"🔧", points:12, impact:7}, // wrench
];

const BAD_ITEMS = [
  {icon:"💥", points:-15}, // impact/explosion
  {icon:"🛢️", points:-12}, // oil barrel
  {icon:"⚠️", points:-10}, // caution sign
];

// ---- State
let state = 'HOME';          // HOME | PLAYING | PAUSED | RESULTS
let lane = 1;                // 0..2
let score = 0, lives = 3, impact = 0, timer = 60; // 60s run
let lastSpawn = 0, spawnGap = 900, speed = 120;
let objects = [];
let rafId = 0, lastTime = 0;

// ---- Helpers
function show(view) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[view].classList.add('active');
}
function setLane(n) {
  lane = Math.max(0, Math.min(2, n));
  const w = playArea.clientWidth / 3;
  player.style.left = ((lane + 0.5) * w) + 'px';
}
function updateHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = '♥'.repeat(lives);
  impactFill.style.width = impact + '%';
}
function pop(text) {
  const f = document.createElement('div');
  f.className = 'pop';
  f.style.left = player.style.left;
  f.textContent = text;
  playArea.appendChild(f);
  setTimeout(()=> f.remove(), 600);
}

// ---- Confetti (simple, no libs)
function burstConfetti(count = 80) {
  // brand-friendly colors: yellow + neutrals
  const colors = ['#FFC907','#ffd74a','#fff1a6','#e5e7eb','#c7cad1'];
  const w = playArea.clientWidth;
  for (let i=0; i<count; i++){
    const piece = document.createElement('div');
    piece.className = 'confetto';
    piece.style.left = Math.random()*w + 'px';
    piece.style.top = '-10px';
    piece.style.background = colors[Math.floor(Math.random()*colors.length)];
    piece.style.transform = `rotate(${Math.random()*180}deg)`;
    piece.style.animationDuration = (0.9 + Math.random()*0.8) + 's';
    confettiLayer.appendChild(piece);
    setTimeout(()=> piece.remove(), 1600);
  }
}

// ---- Game loop functions
function spawn(ts) {
  if (ts - lastSpawn < spawnGap) return;
  lastSpawn = ts;
  spawnGap = Math.max(500, 700 + Math.random() * 500);

  const laneIndex = Math.floor(Math.random() * 3);
  const isGood = Math.random() < 0.6; // 60% good
  const item = isGood
    ? GOOD_ITEMS[Math.floor(Math.random() * GOOD_ITEMS.length)]
    : BAD_ITEMS[Math.floor(Math.random() * BAD_ITEMS.length)];

  const el = document.createElement('div');
  el.className = 'object ' + (isGood ? 'good' : 'hazard');
  el.dataset.good = isGood ? '1' : '0';
  el.dataset.lane = laneIndex;
  el.dataset.y = '-40';
  el.dataset.points = String(item.points);
  el.dataset.impact = String(item.impact || 0);
  el.style.left = ((laneIndex + 0.5) * (playArea.clientWidth/3) - 10) + 'px';
  el.textContent = item.icon;

  playArea.appendChild(el);
  objects.push(el);
}

function step(dt) {
  speed = Math.min(260, speed + dt * 2);

  for (let i = objects.length - 1; i >= 0; i--) {
    const el = objects[i];
    let y = parseFloat(el.dataset.y);
    y += speed * dt;
    el.dataset.y = String(y);
    el.style.top = y + 'px';

    const sameLane = parseInt(el.dataset.lane,10) === lane;
    const hitBandTop = playArea.clientHeight - 100;
    const hitBandBottom = playArea.clientHeight - 40;

    if (sameLane && y > hitBandTop && y < hitBandBottom) {
      const good = el.dataset.good === '1';
      const pts = parseInt(el.dataset.points, 10) || 0;
      const imp = parseInt(el.dataset.impact, 10) || 0;

      if (good) {
        score = Math.max(0, score + pts);
        impact = Math.min(100, impact + imp);
        pop(`${pts > 0 ? '+' : ''}${pts}`);
      } else {
        lives = Math.max(0, lives - 1);
        score = Math.max(0, score + pts); // negative
        pop(`−1 ♥  ${pts}`);
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

function loop(ts) {
  if (state !== 'PLAYING') return;
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

// ---- Controls
window.addEventListener('keydown', e => {
  if (state !== 'PLAYING') return;
  if (e.key === 'ArrowLeft') setLane(lane - 1);
  if (e.key === 'ArrowRight') setLane(lane + 1);
});

let touchX = null;
playArea.addEventListener('touchstart', e => { touchX = e.changedTouches[0].clientX; }, {passive:true});
playArea.addEventListener('touchend', e => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 30) setLane(lane + (dx > 0 ? 1 : -1));
  touchX = null;
}, {passive:true});

// ---- Transitions
function startRun() {
  state = 'PLAYING';
  show('game');
  score = 0; lives = 3; impact = 0; timer = 60;
  lastSpawn = 0; spawnGap = 900; speed = 120; lastTime = 0;
  objects.forEach(o => o.remove()); objects = [];
  confettiLayer.innerHTML = ''; // clear old confetti
  setLane(1); updateHUD();
  rafId = requestAnimationFrame(loop);
}

function endRun(reason = 'normal') {
  state = 'RESULTS';
  cancelAnimationFrame(rafId);

  if (reason === 'impact') {
    resultTitle.textContent = 'Impact Reached! 🎉';
    factTitle.textContent = 'Great job!';
    factBody.textContent  = 'Your Impact bar hit 100%. Thanks for learning and sharing clean water facts.';
    // confetti burst
    burstConfetti(100);
  } else {
    resultTitle.textContent = 'Run Complete!';
    const fact = FACTS[Math.floor(Math.random()*FACTS.length)];
    factTitle.textContent = fact.title;
    factBody.textContent = fact.text;
  }
  show('results');
}

// ---- Buttons
btn.play.addEventListener('click', startRun);
btn.how.addEventListener('click', () => modals.how.showModal());
btn.closeHow.addEventListener('click', () => modals.how.close());
btn.pause.addEventListener('click', () => {
  if (state !== 'PLAYING') return;
  state = 'PAUSED';
  cancelAnimationFrame(rafId);
  modals.pause.showModal();
});
btn.resume.addEventListener('click', () => {
  if (state !== 'PAUSED') return;
  modals.pause.close();
  state = 'PLAYING'; lastTime = 0;
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
console.log('Drop Run ready (confetti on win, brand bar, results Home button).');
