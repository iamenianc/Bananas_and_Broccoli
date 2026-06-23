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
let score = 0;
let elapsed = 0;         // seconds alive
let spawnTimer = 0;
let holding = false;     // finger down = swatting
let swatHoldTimer = 0;   // tolerance buffer for taps
let broccoliEaten = 0;   // counts toward the lose condition
let yuckTimer    = 0;    // >0 while baby shows the disgusted-broccoli face
let powerupTimer = 0;    // >0 while power-up buff is active (baby shows the eat face)
let bananaStreak = 0;    // consecutive bananas caught; hitting the goal triggers the buff
let barrageTimer = 0;    // >0 while barrage is active
let timeSinceLastBarrage = 50; // seconds since last barrage ended
let lastBroccoliEaten = 0; // tracking for HUD flash checks
let lastT = 0;
let babyBobY = 0;        // current vertical idle-drift offset (px) about the origin
let babyBobTarget = 0;   // drift target the offset is easing toward
let babyBobReseed = 0;   // seconds until a new random drift target is picked

function reset(){
  items = []; score = 0; elapsed = 0; spawnTimer = 0;
  holding = false; swatHoldTimer = 0; broccoliEaten = 0; yuckTimer = 0; powerupTimer = 0;
  bananaStreak = 0;
  barrageTimer = 0;
  lastBroccoliEaten = 0;
  timeSinceLastBarrage = 50;
  babyBobY = 0; babyBobTarget = 0; babyBobReseed = 0;
  hudScore.textContent = '0';
  updateBroccoliHud();
}

// Render lives as a row of hearts — one per allowed broccoli. Each broccoli
// eaten loses a heart; the row empties from the right as lives are spent.
function updateBroccoliHud(){
  let html = '';
  for (let i=0; i<CONFIG.broccoliEatenLimit; i++){
    const alive = i < CONFIG.broccoliEatenLimit - broccoliEaten;
    const cls = alive ? 'b left' : 'b lost';
    html += '<span class="' + cls + '"></span>';
  }
  hudBroccoli.innerHTML = html;
  hudBroccoli.classList.toggle('warn',
    broccoliEaten >= CONFIG.broccoliEatenLimit - 3);

  if (broccoliEaten > lastBroccoliEaten) {
    hudBroccoli.classList.remove('flash');
    void hudBroccoli.offsetWidth; // trigger reflow to restart animation
    hudBroccoli.classList.add('flash');
  }
  lastBroccoliEaten = broccoliEaten;
}

function babyPos(){
  return { x: CONFIG.babyHeadX, y: CONFIG.babyHeadY + babyBobY };
}

function babyHandPos(){
  const babyScale = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
  return { x: CONFIG.babyHeadX + CONFIG.babyHandDX * babyScale,
           y: CONFIG.babyHeadY + babyBobY + CONFIG.babyHandDY * babyScale };
}

function currentSpeed(){
  let base = Math.min(CONFIG.maxSpeed,
    CONFIG.baseSpeed + CONFIG.accelPerSec*elapsed);
  if (barrageTimer > 0) {
    base *= CONFIG.barrageSpeedMult;
  }
  return powerupTimer > 0 ? base * CONFIG.powerupSpeedMult : base;
}
function currentSpawnInterval(){
  if (barrageTimer > 0) {
    return CONFIG.barrageSpawnEvery;
  }
  return Math.max(CONFIG.spawnEveryMin,
    CONFIG.spawnEveryStart - CONFIG.spawnRampPerSec*elapsed);
}

function spawnOne(sy, isDecoy){
  let type;
  if (barrageTimer > 0) {
    type = 'broccoli';
  } else if (!isDecoy && Math.random() < CONFIG.powerupChance){
    type = 'powerup';
  } else {
    type = Math.random() < CONFIG.broccoliChance ? 'broccoli' : 'banana';
  }
  const r = CONFIG.itemRadius;
  const target = babyHandPos();
  const sx = VW + r;
  // real items aim at the target (baby's hands); decoys aim at a point well above/below
  // the catch zone so they sail past and miss.
  const aimY = isDecoy
    ? target.y + (Math.random()<0.5 ? -1 : 1) * CONFIG.decoyMissOffset
    : target.y;
  const dx = target.x - sx, dy = aimY - sy;
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
  const item = {
    x:sx, y:sy, r, type, resolved:false, decoy:isDecoy, delay,
    ux:dx/len, uy:dy/len,
    vx:dx/len*sp, vy:dy/len*sp
  };
  if (type === 'powerup'){ item.rot = 0; item.spin = CONFIG.powerupSpinRate; }
  items.push(item);
}

// Predicted arrival times (seconds from now) of all incoming real items,
// used to space out new spawns so hits don't land simultaneously.
function incomingArrivals(sp){
  const target = babyHandPos();
  const out = [];
  for (const it of items){
    if (it.resolved || it.flying || it.decoy) continue;
    const d = Math.hypot(it.x - target.x, it.y - target.y);
    out.push((it.delay > 0 ? it.delay : 0) + d/sp);
  }
  return out;
}

function spawn(){
  const band = VH * CONFIG.spawnYJitter;
  const n = CONFIG.burstMin + Math.floor(Math.random()*(CONFIG.burstMax-CONFIG.burstMin+1));
  // spread the burst's spawn heights across the middle of the screen so
  // items enter from different points (independent of the baby's anchor).
  for (let i=0; i<n; i++){
    const sy = VH/2 + (Math.random()-0.5)*band;
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
  const swatting = holding || swatHoldTimer > 0;
  if (it.type === 'powerup'){
    if (swatting){
      it.flying = true;
      ricochet(it);
    } else {
      it.resolved = true;
      if (broccoliEaten > 0) {
        broccoliEaten--;
        updateBroccoliHud();
      }
    }
  } else if (it.type === 'banana'){
    if (swatting){
      if (score === 0) {
        broccoliEaten++;
        updateBroccoliHud();
        if (broccoliEaten >= CONFIG.broccoliEatenLimit) {
          hudScore.textContent = score;
          return 'Deflected a banana at 0 points with no lives left.';
        }
      }
      score -= CONFIG.bananaSwatPenalty;
      it.flying = true;
      it.peeled = true;
      bananaStreak = 0;                 // rejecting a banana breaks the streak
      ricochet(it);
    } else {
      it.resolved = true;
      score += CONFIG.pointsPerBanana * (powerupTimer > 0 ? 2 : 1);
      // build toward the streak reward (only while not already powered up)
      if (powerupTimer <= 0 && ++bananaStreak >= CONFIG.streakForPowerup){
        powerupTimer = CONFIG.powerupDuration;
        bananaStreak = 0;
      }
    }
  } else { // broccoli
    if (!swatting){
      it.resolved = true;
      if (powerupTimer > 0){
        // powered up: broccoli is harmless
      } else {
        score -= CONFIG.penaltyPoints;
        broccoliEaten++;
        bananaStreak = 0;               // eating broccoli breaks the streak
        yuckTimer = CONFIG.yuckFaceTime;
        updateBroccoliHud();
        if (broccoliEaten >= CONFIG.broccoliEatenLimit){
          if (score < 0) score = 0;
          hudScore.textContent = score;
          return 'You ate ' + CONFIG.broccoliEatenLimit + ' broccoli.';
        }
      }
    } else {
      it.flying = true;
      it.touchedBaby = true;
      ricochet(it);
    }
  }
  if (score < 0) score = 0;
  hudScore.textContent = score;
  return null;
}

function update(dt){
  elapsed += dt;

  // slow random vertical bob: ease toward a fresh random target now and then
  babyBobReseed -= dt;
  if (babyBobReseed <= 0){
    babyBobTarget = (Math.random()*2 - 1) * CONFIG.babyBobAmp;
    babyBobReseed = CONFIG.babyBobReseedMin +
      Math.random()*(CONFIG.babyBobReseedMax - CONFIG.babyBobReseedMin);
  }
  babyBobY += (babyBobTarget - babyBobY) * Math.min(1, dt * CONFIG.babyBobEase);
  if (barrageTimer > 0) {
    barrageTimer -= dt;
    if (barrageTimer <= 0) {
      timeSinceLastBarrage = 0;
    }
  } else {
    timeSinceLastBarrage += dt;
    if (timeSinceLastBarrage >= CONFIG.barrageMinCooldown) {
      if (Math.random() < CONFIG.barrageChancePerSec * dt) {
        barrageTimer = CONFIG.barrageDuration;
        spawnTimer = 0; // Trigger an immediate burst
      }
    }
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0){ spawn(); spawnTimer = currentSpawnInterval(); }

  if (swatHoldTimer > 0) swatHoldTimer -= dt;

  const target = babyHandPos();
  const sp = currentSpeed();
  const swatting = holding || swatHoldTimer > 0;
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

    if (powerupTimer > 0 && it.type === 'banana') {
      const dx = target.x - it.x;
      const dy = target.y - it.y;
      const len = Math.hypot(dx, dy) || 1;
      it.ux = dx / len;
      it.uy = dy / len;
    }

    // incoming item: keep moving along the fixed aim direction
    const speed = sp + (swatting ? CONFIG.swatNudge : 0);
    it.vx = it.ux * speed;
    it.vy = it.uy * speed;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    if (it.type === 'powerup') it.rot = (it.rot || 0) + it.spin * dt;
    // resolve when it reaches the baby's hands
    if (Math.hypot(it.x - target.x, it.y - target.y) <= CONFIG.resolveRadius){
      const reason = resolve(it);
      if (reason){ gameOver(reason); return; }
    }
  }
  // flying banana hitting an incoming broccoli: both tumble off-screen together
  for (const flt of items){
    if (!flt.flying || flt.type !== 'banana' || flt.hitBroccoli) continue;
    for (const inc of items){
      if (inc.flying || inc.resolved || inc.type !== 'broccoli') continue;
      if (Math.hypot(flt.x - inc.x, flt.y - inc.y) <= flt.r + inc.r){
        flt.hitBroccoli = true;
        const downAng = Math.PI * 0.5 + (Math.random() - 0.5) * 0.5;
        const spd = Math.hypot(flt.vx, flt.vy) * 0.7 + 250;
        flt.vx = Math.cos(downAng) * spd;
        flt.vy = Math.sin(downAng) * spd;
        flt.spin = (Math.random() * 2 - 1) * CONFIG.swatSpinMax;
        inc.flying = true;
        inc.vx = flt.vx + (Math.random() - 0.5) * 60;
        inc.vy = flt.vy + (Math.random() - 0.5) * 60;
        inc.spin = (Math.random() * 2 - 1) * CONFIG.swatSpinMax;
        inc.rot = 0;
        break;
      }
    }
  }
  // flying broccoli hitting an incoming broccoli: 50% chance to knock it offscreen
  for (const flt of items){
    if (!flt.flying || flt.type !== 'broccoli' || !flt.touchedBaby) continue;
    for (const inc of items){
      if (inc.flying || inc.resolved || inc.type !== 'broccoli') continue;
      if (Math.hypot(flt.x - inc.x, flt.y - inc.y) <= flt.r + inc.r){
        inc.checkedBy = inc.checkedBy || [];
        if (!inc.checkedBy.includes(flt)) {
          inc.checkedBy.push(flt);
          if (Math.random() < 0.5){
            const ang = Math.atan2(flt.vy, flt.vx) + (Math.random() - 0.5) * 1.0;
            inc.flying = true;
            inc.vx = Math.cos(ang) * CONFIG.swatBackSpeed;
            inc.vy = Math.sin(ang) * CONFIG.swatBackSpeed;
            inc.spin = (Math.random() * 2 - 1) * CONFIG.swatSpinMax;
            inc.rot = 0;
          }
        }
        break;
      }
    }
  }
  // cull resolved items, and anything fully off-screen (any edge)
  items = items.filter(it =>
    !it.resolved &&
    it.x > -120 && it.x < VW+120 && it.y > -120 && it.y < VH+120
  );
  const modeLabel = barrageTimer > 0
    ? '⚠️ BARRAGE!'
    : powerupTimer > 0
      ? '★ ' + Math.ceil(powerupTimer) + 's'
      : bananaStreak > 0
        ? '🍌 ' + bananaStreak + '/' + CONFIG.streakForPowerup
        : swatting ? 'SWATTING' : 'CATCHING';
  if (hudMode.textContent !== modeLabel) hudMode.textContent = modeLabel;
  if (yuckTimer    > 0) yuckTimer    -= dt;
  if (powerupTimer > 0) powerupTimer -= dt;
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
  ART.background(ctx, VW, VH, elapsed);

  const baby = babyPos();
  for (const it of items){
    if (it.resolved) continue;
    if (it.flying){
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot || 0);
      if (it.peeled)             ART.bananaPeeled(ctx, 0, 0, it.r);
      else if (it.type==='powerup') ART.powerup(ctx, 0, 0, it.r);
      else                       ART.broccoli(ctx, 0, 0, it.r);
      ctx.restore();
    } else if (it.type==='powerup'){
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot || 0);
      ART.powerup(ctx, 0, 0, it.r);
      ctx.restore();
    } else if (it.type==='banana'){
      ART.banana(ctx, it.x, it.y, it.r);
    } else {
      ART.broccoli(ctx, it.x, it.y, it.r);
    }
  }
  const swatting = holding || swatHoldTimer > 0;
  let face;
  // The eat face is reserved for the power-up: it shows for the whole buff.
  if (powerupTimer > 0)    face = 'eating';
  else if (swatting)       face = 'swat';
  else if (yuckTimer  > 0) face = 'yuck';
  else {
    // lunge into the 'catch' pose as a real item closes in; otherwise the
    // baby stands calmly in the 'neutral' pose.
    let closing = false;
    for (const it of items){
      if (it.resolved || it.flying || it.decoy) continue;
      if (it.x - baby.x < CONFIG.catchAnticipateDist){ closing = true; break; }
    }
    face = closing ? 'catch' : 'neutral';
  }
  const babyScale = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
  ART.baby(ctx, baby.x, baby.y, swatting, face, babyScale);
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
function down(e){
  if(state===State.PLAY){
    holding=true;
    swatHoldTimer = CONFIG.swatHoldDuration;
    yuckTimer = 0;
  }
  e.preventDefault();
}
function up(e){ if(state===State.PLAY){ holding=false; } e.preventDefault(); }
canvas.addEventListener('pointerdown', down, { passive: false });
window.addEventListener('pointerup',     up,  { passive: false });
window.addEventListener('pointercancel', up,  { passive: false });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);

/* register service worker if available (PWA) */
if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
