/* ============================================================
   BANANAS & BROCCOLI — ENGINE
   ------------------------------------------------------------
   Spawning, physics, input, scoring and the main loop. Depends
   on the globals from config.js (CONFIG) and art.js (ART), which
   must be loaded before this file.
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hudScore = document.getElementById('score');
const hudMode  = document.getElementById('mode');
const hudBroccoli = document.getElementById('broccoli');

let W=0, H=0, DPR=1;
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W*DPR; canvas.height = H*DPR;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize', resize);
resize();

const State = { MENU:'menu', PLAY:'play', OVER:'over' };
let state = State.MENU;

let items = [];          // {x,y,vy,type:'banana'|'broccoli',r,resolved}
let score = 0;
let elapsed = 0;         // seconds alive
let spawnTimer = 0;
let holding = false;     // finger down = swatting
let broccoliEaten = 0;   // counts toward the lose condition
let happyTimer = 0;      // >0 while baby shows the eating-banana face
let lastT = 0;

function reset(){
  items = []; score = 0; elapsed = 0; spawnTimer = 0;
  holding = false; broccoliEaten = 0; happyTimer = 0;
  hudScore.textContent = '0';
  updateBroccoliHud();
}

// Render the broccoli "lives" as a row of broccoli icons — one per
// allowed broccoli — filling in as they're eaten, instead of a N/6 tally.
function updateBroccoliHud(){
  let html = '';
  for (let i=0; i<CONFIG.broccoliEatenLimit; i++){
    const cls = i < broccoliEaten ? 'b eaten' : 'b left';
    html += '<span class="' + cls + '">🥦</span>';
  }
  hudBroccoli.innerHTML = html;
  hudBroccoli.classList.toggle('warn',
    broccoliEaten >= CONFIG.broccoliEatenLimit - 2);
}

function babyPos(){
  return { x: CONFIG.babyXFromLeft, y: H/2 };
}

function currentSpeed(){
  return Math.min(CONFIG.maxSpeed,
    CONFIG.baseSpeed + CONFIG.accelPerSec*elapsed);
}
function currentSpawnInterval(){
  return Math.max(CONFIG.spawnEveryMin,
    CONFIG.spawnEveryStart - CONFIG.spawnRampPerSec*elapsed);
}

function spawnOne(sy, isDecoy){
  const type = Math.random() < CONFIG.broccoliChance ? 'broccoli' : 'banana';
  const r = CONFIG.itemRadius;
  const baby = babyPos();
  const sx = W + r;
  // real items aim at the baby; decoys aim at a point well above/below
  // the catch zone so they sail past and miss.
  const aimY = isDecoy
    ? baby.y + (Math.random()<0.5 ? -1 : 1) * CONFIG.decoyMissOffset
    : baby.y;
  const dx = baby.x - sx, dy = aimY - sy;
  const len = Math.hypot(dx, dy) || 1;
  const sp = currentSpeed();
  // Stagger arrivals: nudge this item's launch delay until its predicted
  // arrival time is clear of every other incoming real item's arrival,
  // so two things rarely reach the baby at the exact same instant.
  let delay = 0;
  if (!isDecoy){
    const others = incomingArrivals(sp);
    let arrival = len/sp;
    let guard = 0;
    while (delay < CONFIG.maxArrivalDelay && guard++ < 32 &&
           others.some(a => Math.abs(a - arrival) < CONFIG.minArrivalGap)){
      delay += CONFIG.arrivalDelayStep;
      arrival = delay + len/sp;
    }
  }
  items.push({
    x:sx, y:sy, r, type, resolved:false, decoy:isDecoy, delay,
    ux:dx/len, uy:dy/len,
    vx:dx/len*sp, vy:dy/len*sp
  });
}

// Predicted arrival times (seconds from now) of all incoming real items,
// used to space out new spawns so hits don't land simultaneously.
function incomingArrivals(sp){
  const baby = babyPos();
  const out = [];
  for (const it of items){
    if (it.resolved || it.flying || it.decoy) continue;
    const d = Math.hypot(it.x - baby.x, it.y - baby.y);
    out.push((it.delay > 0 ? it.delay : 0) + d/sp);
  }
  return out;
}

function spawn(){
  const baby = babyPos();
  const band = H * CONFIG.spawnYJitter;
  const n = CONFIG.burstMin + Math.floor(Math.random()*(CONFIG.burstMax-CONFIG.burstMin+1));
  // spread the burst's spawn heights so they enter from different points
  for (let i=0; i<n; i++){
    const sy = baby.y + (Math.random()-0.5)*band;
    const isDecoy = Math.random() < CONFIG.decoyChance;
    spawnOne(sy, isDecoy);
  }
}

// Launch a swatted/rejected item back the way it came (opposite of its
// incoming heading) with a little random spread and spin.
function ricochet(it){
  const back = Math.atan2(-it.uy, -it.ux);          // opposite direction
  const ang = back + (Math.random()*2-1) * (40*Math.PI/180);
  it.vx = Math.cos(ang) * CONFIG.swatBackSpeed;
  it.vy = Math.sin(ang) * CONFIG.swatBackSpeed;
  it.spin = (Math.random()*2-1) * CONFIG.swatSpinMax;
  it.rot = 0;
}

// Resolve an item that reached the baby. Returns reason string if game over.
function resolve(it){
  if (it.type === 'banana'){
    if (holding){
      score -= CONFIG.bananaSwatPenalty;                   // rejected food: -3
      // rejected banana: ends up half peeled and bounces away in the
      // opposite direction it came from.
      it.flying = true;
      it.peeled = true;
      ricochet(it);
    } else {
      it.resolved = true;
      score += CONFIG.pointsPerBanana;                     // caught: +1
      happyTimer = CONFIG.happyFaceTime;                   // baby looks delighted
    }
  } else { // broccoli
    if (!holding){
      it.resolved = true;
      score -= CONFIG.penaltyPoints;                       // eaten: -1
      broccoliEaten++;
      updateBroccoliHud();
      if (broccoliEaten >= CONFIG.broccoliEatenLimit){
        if (score < 0) score = 0;
        hudScore.textContent = score;
        return 'You ate ' + CONFIG.broccoliEatenLimit + ' broccoli.';
      }
    } else {
      // swatted! launch it back to the right on a random trajectory
      it.flying = true;
      ricochet(it);
    }
  }
  if (score < 0) score = 0;
  hudScore.textContent = score;
  return null;
}

function update(dt){
  elapsed += dt;
  spawnTimer -= dt;
  if (spawnTimer <= 0){ spawn(); spawnTimer = currentSpawnInterval(); }

  const baby = babyPos();
  const sp = currentSpeed();
  for (const it of items){
    if (it.resolved) continue;

    if (it.flying){
      // swatted broccoli: travels on its own velocity, spinning, no re-resolve
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.spin * dt;
      continue;
    }

    // held back briefly to stagger its arrival — wait off-screen
    if (it.delay > 0){ it.delay -= dt; continue; }

    // incoming item: keep moving along the fixed aim direction
    const speed = sp + (holding ? CONFIG.swatNudge : 0);
    it.vx = it.ux * speed;
    it.vy = it.uy * speed;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    // resolve when it reaches the baby
    if (Math.hypot(it.x - baby.x, it.y - baby.y) <= CONFIG.resolveRadius){
      const reason = resolve(it);
      if (reason){ gameOver(reason); return; }
    }
  }
  // cull resolved items, and anything fully off-screen (any edge)
  items = items.filter(it =>
    !it.resolved &&
    it.x > -120 && it.x < W+120 && it.y > -120 && it.y < H+120
  );
  hudMode.textContent = holding ? 'SWATTING' : 'CATCHING';
  if (happyTimer > 0) happyTimer -= dt;
}

function render(){
  ctx.clearRect(0,0,W,H);
  const baby = babyPos();
  ART.catchZone(ctx, baby.x, baby.y, CONFIG.resolveRadius);
  for (const it of items){
    if (it.resolved) continue;
    if (it.flying){
      // swatted item tumbling away
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot || 0);
      if (it.peeled)      ART.bananaPeeled(ctx, 0, 0, it.r);
      else                ART.broccoli(ctx, 0, 0, it.r);
      ctx.restore();
    } else if (it.type==='banana'){
      ART.banana(ctx, it.x, it.y, it.r);
    } else {
      ART.broccoli(ctx, it.x, it.y, it.r);
    }
  }
  const face = happyTimer > 0 ? 'eating' : (holding ? 'swat' : 'catch');
  ART.baby(ctx, baby.x, baby.y, holding, face);
}

function loop(t){
  if (state !== State.PLAY){ return; }
  if (!lastT) lastT = t;
  let dt = (t - lastT)/1000; lastT = t;
  if (dt > 0.05) dt = 0.05; // clamp big tab-switch gaps
  update(dt);
  if (state === State.PLAY) render();
  requestAnimationFrame(loop);
}

/* ---- state transitions ---- */
function startGame(){
  reset();
  state = State.PLAY;
  document.getElementById('start').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  lastT = 0;
  requestAnimationFrame(loop);
}
function gameOver(reason){
  state = State.OVER;
  document.getElementById('finalScore').textContent = 'Score: ' + score;
  document.getElementById('goReason').textContent = reason;
  document.getElementById('gameover').classList.remove('hidden');
}

/* ---- input: hold anywhere = swat ---- */
function down(e){ if(state===State.PLAY){ holding=true; } e.preventDefault(); }
function up(e){ if(state===State.PLAY){ holding=false; } e.preventDefault(); }
canvas.addEventListener('pointerdown', down);
window.addEventListener('pointerup', up);
window.addEventListener('pointercancel', up);

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);

/* register service worker if available (PWA) */
if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
