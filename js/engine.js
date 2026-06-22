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

// The game is drawn in the FIXED virtual world (CONFIG.worldW x worldH).
// On resize we only recompute how that fixed world is scaled & centered to
// fit the actual screen — the world coordinates themselves never change, so
// the relative position of every object is unaffected by window resizing.
const VW = CONFIG.worldW, VH = CONFIG.worldH;
let DPR=1, scale=1, offX=0, offY=0;
function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2);
  const cssW = window.innerWidth, cssH = window.innerHeight;
  canvas.style.width = cssW+'px';
  canvas.style.height = cssH+'px';
  canvas.width  = Math.round(cssW*DPR);
  canvas.height = Math.round(cssH*DPR);
  // "contain" fit: uniformly scale the world to fit, then center it.
  scale = Math.min(cssW/VW, cssH/VH);
  offX = (cssW - VW*scale)/2;
  offY = (cssH - VH*scale)/2;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const State = { MENU:'menu', PLAY:'play', OVER:'over' };
let state = State.MENU;

let items = [];          // {x,y,vy,type:'banana'|'broccoli',r,resolved}
let spoons = [];         // {y, age} cosmetic flick animations at the right edge
let score = 0;
let elapsed = 0;         // seconds alive
let spawnTimer = 0;
let holding = false;     // finger down = swatting
let broccoliEaten = 0;   // counts toward the lose condition
let happyTimer = 0;      // >0 while baby shows the eating-banana face
let lastT = 0;

function reset(){
  items = []; spoons = []; score = 0; elapsed = 0; spawnTimer = 0;
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
  return { x: CONFIG.babyXFromLeft, y: VH/2 };
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
  const sx = VW + r;
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
  const band = VH * CONFIG.spawnYJitter;
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
      score -= CONFIG.bananaSwatPenalty;                   // rejected food: -1
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

    // first frame it enters play: flick a spoon at the right edge to
    // "launch" it (item hasn't moved yet, so it.y is its spawn height).
    if (!it.launched){ it.launched = true; spoons.push({ y: it.y, age: 0 }); }

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
    it.x > -120 && it.x < VW+120 && it.y > -120 && it.y < VH+120
  );
  // advance & retire spoon flick animations
  for (const sp of spoons) sp.age += dt;
  spoons = spoons.filter(sp => sp.age < CONFIG.spoonDur);
  hudMode.textContent = holding ? 'SWATTING' : 'CATCHING';
  if (happyTimer > 0) happyTimer -= dt;
}

function render(){
  // clear the whole device buffer (identity transform)
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // map drawing into the fixed virtual world: scaled & centered to fit.
  ctx.setTransform(scale*DPR,0,0,scale*DPR, offX*DPR, offY*DPR);
  ctx.save();
  // clip to the playfield so off-screen spawns / spoon handles and the
  // letterbox margins stay clean.
  ctx.beginPath(); ctx.rect(0,0,VW,VH); ctx.clip();
  // white playfield + faint frame so the bounds read on any screen
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,VW,VH);
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1,1,VW-2,VH-2);

  const baby = babyPos();
  ART.catchZone(ctx, baby.x, baby.y, CONFIG.resolveRadius);
  // spoons flicking food in from the right edge
  for (const sp of spoons){
    const p = Math.min(1, sp.age/CONFIG.spoonDur);
    const ease = 1-(1-p)*(1-p);                       // easeOutQuad
    const angle = CONFIG.spoonWindAngle +
                  (CONFIG.spoonFlickAngle - CONFIG.spoonWindAngle)*ease;
    ART.spoon(ctx, VW, sp.y, angle);
  }
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
  ctx.restore();
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

/* ---- fullscreen ---------------------------------------------------------
   Browsers refuse to enter fullscreen without a user gesture, so we can't
   force it on load. Instead we request it on the very first interaction
   (and again on START), which is as close to "on opening" as is allowed.
   Installed as a PWA, the manifest's display:fullscreen already applies. */
function goFullscreen(){
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen
            || el.mozRequestFullScreen || el.msRequestFullscreen;
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  if (req && !active){
    try { const p = req.call(el); if (p && p.catch) p.catch(()=>{}); } catch(e){}
  }
  // best-effort landscape lock (supported only in some fullscreen browsers)
  const lock = screen.orientation && screen.orientation.lock;
  if (lock){ try { screen.orientation.lock('landscape').catch(()=>{}); } catch(e){} }
}
// arm on the first gesture anywhere, so opening + first tap goes fullscreen
(function armFullscreen(){
  const once = ()=>{
    goFullscreen();
    window.removeEventListener('pointerdown', once);
    window.removeEventListener('keydown', once);
  };
  window.addEventListener('pointerdown', once);
  window.addEventListener('keydown', once);
})();

/* ---- state transitions ---- */
function startGame(){
  goFullscreen();
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
