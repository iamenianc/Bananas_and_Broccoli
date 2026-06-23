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
const hudPower = document.getElementById('power');
const hudLevel = document.getElementById('level');

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

let items = [];          // {x,y,vx,vy,ux,uy,r,type:'banana'|'broccoli'|'powerup',resolved,...}
let score = 0;
let level = 1;           // difficulty level; advances each time score hits pointsPerLevel
let bananasEaten = 0;    // cumulative bananas caught across ALL levels (loser-screen stat)
let levelFlashTimer = 0; // >0 while the new level's name flashes/fades at centre
let elapsed = 0;         // seconds alive (animation only; difficulty is level-based)
let spawnTimer = 0;
let holding = false;     // finger down = swatting
let swatHoldTimer = 0;   // tolerance buffer for taps
let broccoliEaten = 0;   // counts toward the lose condition
let yuckTimer    = 0;    // >0 while baby shows the disgusted-broccoli face
let powerupTimer = 0;    // >0 while power-up buff is active (baby shows the eat face)
let charging = false;    // true while charging the buff after catching the disco ball
let chargeTimer = 0;     // seconds of clean play accumulated toward the buff
let lastPowerFilled = -1;// last segment count rendered in the power meter
let powerVisible = false;// last visibility state of the power meter
let barrageTimer = 0;    // >0 while barrage is active
let timeSinceLastBarrage = 50; // seconds since last barrage ended
let lastBroccoliEaten = 0; // tracking for HUD flash checks
let lastT = 0;
let babyBobY = 0;        // current vertical idle-drift offset (px) about the origin
let babyBobTarget = 0;   // drift target the offset is easing toward
let babyBobReseed = 0;   // seconds until a new random drift target is picked

function reset(){
  items = []; score = 0; level = 1; bananasEaten = 0; levelFlashTimer = 0;
  elapsed = 0; spawnTimer = 0;
  holding = false; swatHoldTimer = 0; broccoliEaten = 0; yuckTimer = 0; powerupTimer = 0;
  charging = false; chargeTimer = 0;
  barrageTimer = 0;
  lastBroccoliEaten = 0;
  timeSinceLastBarrage = 50;
  babyBobY = 0; babyBobTarget = 0; babyBobReseed = 0;
  hudScore.textContent = '0';
  updateBroccoliHud();
  updatePowerMeter();
  updateLevelHud();
}

// Show which difficulty level we're on in the corner.
function updateLevelHud(){
  if (hudLevel) hudLevel.textContent = 'LEVEL ' + level;
}

// Points needed to complete the CURRENT level. The target grows 5% per level:
// target(level) = pointsPerLevel * levelPointsGrowth^(level-1), rounded.
function pointsToAdvance(){
  return Math.round(CONFIG.pointsPerLevel *
    Math.pow(CONFIG.levelPointsGrowth, level - 1));
}

// Knock every banana/broccoli currently on the field tumbling off the bottom
// of the screen (used on level-up so the board clears without a pause).
function knockdownField(){
  for (const it of items){
    if (it.resolved || it.flying) continue;
    if (it.type !== 'banana' && it.type !== 'broccoli') continue;
    it.flying = true;
    const ang = Math.PI * 0.5 + (Math.random() - 0.5) * 0.7;   // mostly downward
    const spd = CONFIG.swatBackSpeed * (0.6 + Math.random() * 0.5);
    it.vx = Math.cos(ang) * spd;
    it.vy = Math.sin(ang) * spd;
    it.spin = (Math.random() * 2 - 1) * CONFIG.swatSpinMax;
    it.rot = 0;
  }
}

// Advance to the next level: bump difficulty and reset the per-level score to 1.
// Play is CONTINUOUS — no freeze — but every banana/broccoli on the field is
// knocked down so the board clears as the next, faster level begins. Any active
// buff/charge is cancelled.
function levelUp(){
  level++;
  score = 1;
  powerupTimer = 0;                 // cancel any active buff
  charging = false; chargeTimer = 0;// and any charge in progress
  knockdownField();                 // sweep the field clear (no pause)
  levelFlashTimer = CONFIG.levelFlashTime;  // flash the new level's name
  updateLevelHud();
  updatePowerMeter();               // hide the charge meter if it was showing
}

// ---- power-up charge: catch the disco ball, then survive powerupChargeTime
// seconds with no energy loss (broccoli eaten) and no points loss. The meter
// fills one segment per second; any loss cancels the attempt.
function startCharge(){
  if (powerupTimer > 0 || charging) return;   // not while already buffed / charging
  charging = true; chargeTimer = 0;
  updatePowerMeter();
}
function loseCharge(){
  if (!charging) return;
  charging = false; chargeTimer = 0;
  updatePowerMeter();
}
function activatePowerup(){
  powerupTimer = CONFIG.powerupDuration;
  charging = false; chargeTimer = 0;
  updatePowerMeter();
}

// Render the charge meter: one segment per second of powerupChargeTime, the
// elapsed seconds lit. Hidden entirely unless a charge is in progress.
function updatePowerMeter(){
  if (charging !== powerVisible){
    hudPower.classList.toggle('show', charging);
    powerVisible = charging;
    if (!charging){ hudPower.innerHTML = ''; lastPowerFilled = -1; }
  }
  if (!charging) return;
  const total = Math.round(CONFIG.powerupChargeTime);
  const filled = Math.max(0, Math.min(total, Math.floor(chargeTimer)));
  if (filled === lastPowerFilled) return;
  lastPowerFilled = filled;
  let html = '';
  for (let i=0; i<total; i++) html += '<span class="p' + (i<filled?' on':'') + '"></span>';
  hudPower.innerHTML = html;
}

// Render lives as a row of segments — one per life point. The row empties from
// the right as life is spent; because life is fractional (broccoli costs a whole
// point, a banana restores 1%), the boundary segment fades to show the partial.
function updateBroccoliHud(){
  const limit = CONFIG.broccoliEatenLimit;
  const remaining = Math.max(0, limit - broccoliEaten);
  const full = Math.floor(remaining + 1e-9);     // whole life points still lit
  const partial = remaining - full;              // 0..1 fraction in the next seg
  let html = '';
  for (let i=0; i<limit; i++){
    if (i < full){
      html += '<span class="b left"></span>';
    } else if (i === full && partial > 0){
      html += '<span class="b left" style="opacity:' + partial.toFixed(2) + '"></span>';
    } else {
      html += '<span class="b lost"></span>';
    }
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
  // The baby stays at its normal left-edge home even while powered up; at the
  // 2× buff scale the figure still clears every edge of the playfield.
  return { x: CONFIG.babyHeadX, y: CONFIG.babyHeadY + babyBobY };
}

function babyHandPos(){
  const babyScale = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
  const p = babyPos();
  return { x: p.x + CONFIG.babyHandDX * babyScale,
           y: p.y + CONFIG.babyHandDY * babyScale };
}

function currentSpeed(){
  // Speed is CONSTANT within a level and steps up each level on a curve that
  // eases toward maxSpeed, so the per-level jumps shrink as the speed climbs.
  let base = CONFIG.maxSpeed -
    (CONFIG.maxSpeed - CONFIG.baseSpeed) * Math.exp(-(level - 1) / CONFIG.levelSpeedTau);
  if (barrageTimer > 0) {
    base *= CONFIG.barrageSpeedMult;
  }
  return powerupTimer > 0 ? base * CONFIG.powerupSpeedMult : base;
}
function currentSpawnInterval(){
  if (barrageTimer > 0) {
    return CONFIG.barrageSpawnEvery;
  }
  let interval = Math.max(CONFIG.spawnEveryMin,
    CONFIG.spawnEveryStart - CONFIG.spawnRampPerLevel*(level - 1));
  // during the buff, items fly powerupSpeedMult× faster, so spawn them that
  // much more often to keep the screen density rising in line with the speed.
  if (powerupTimer > 0) interval /= CONFIG.powerupSpeedMult;
  return interval;
}

function spawnOne(sy, type, isDecoy, opts){
  opts = opts || {};
  const speedMult = opts.speedMult || 1;
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
  const sp = currentSpeed() * speedMult;
  // Stagger arrivals: nudge this item's launch delay until its predicted
  // arrival time is clear of every other incoming real item's arrival,
  // so two things rarely reach the baby at the exact same instant. A volley
  // passes an explicit delay (opts.delay) to fire its shots in succession.
  let delay = 0;
  if (opts.delay != null){
    delay = opts.delay;
  } else if (!isDecoy){
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

// Pick one of the fixed launch points dedicated to `type`, preferring a
// point not already used this burst so two items don't stack on the same spot.
function pickSpawnPoint(type, used){
  const pts = CONFIG.spawnPoints.filter(p => p.type === type);
  const free = pts.filter(p => !used.has(p));
  const pool = free.length ? free : pts;
  const p = pool[Math.floor(Math.random()*pool.length)];
  used.add(p);
  return p;
}

function spawn(){
  // rare event: a volley of broccoli fired in quick succession at double speed
  if (barrageTimer <= 0 && Math.random() < CONFIG.volleyChance){
    spawnBroccoliVolley();
    return;
  }
  const n = CONFIG.burstMin + Math.floor(Math.random()*(CONFIG.burstMax-CONFIG.burstMin+1));
  const used = new Set();
  for (let i=0; i<n; i++){
    const isDecoy = Math.random() < CONFIG.decoyChance;
    // Decide the food type (preserving the banana/broccoli ratio; bananas
    // occasionally upgrade to the rare power-up), then launch it from a point
    // DEDICATED to that food. Power-ups ride the banana launchers.
    let type;
    if (barrageTimer > 0){
      type = 'broccoli';
    } else if (Math.random() < CONFIG.broccoliChance){
      type = 'broccoli';
    } else if (!isDecoy && Math.random() < CONFIG.powerupChance){
      type = 'powerup';
    } else {
      type = 'banana';
    }
    const baseType = type === 'powerup' ? 'banana' : type;
    const sy = pickSpawnPoint(baseType, used).yFrac * VH;
    spawnOne(sy, type, isDecoy);
  }
}

// A rare broccoli volley: CONFIG.volleyCount broccoli fired straight at the baby
// in quick succession (each held back volleyGap longer than the last) at double
// speed — a sudden flurry the player must swat away in time.
function spawnBroccoliVolley(){
  const used = new Set();
  for (let i=0; i<CONFIG.volleyCount; i++){
    const sy = pickSpawnPoint('broccoli', used).yFrac * VH;
    spawnOne(sy, 'broccoli', false, {
      speedMult: CONFIG.volleySpeedMult,
      delay: i * CONFIG.volleyGap
    });
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
        broccoliEaten = Math.max(0, broccoliEaten - 1);  // refund a full life
        updateBroccoliHud();
      }
      startCharge();                    // begin the clean-play charge attempt
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
      loseCharge();                     // losing points cancels the charge
      ricochet(it);
    } else {
      it.resolved = true;
      score += CONFIG.pointsPerBanana * (powerupTimer > 0 ? 2 : 1);
      bananasEaten++;                   // one banana eaten (cumulative across levels)
      // eating a banana also restores 1% of the life bar
      if (broccoliEaten > 0){
        broccoliEaten = Math.max(0, broccoliEaten -
          CONFIG.bananaLifeRestorePct * CONFIG.broccoliEatenLimit);
        updateBroccoliHud();
      }
    }
  } else { // broccoli
    if (!swatting){
      it.resolved = true;
      if (powerupTimer > 0){
        // powered up: broccoli is harmless but worth nothing — only bananas
        // count toward points while the buff is active.
      } else {
        score -= CONFIG.penaltyPoints;
        broccoliEaten++;
        loseCharge();                   // losing energy cancels the charge
        yuckTimer = CONFIG.yuckFaceTime;
        updateBroccoliHud();
        if (broccoliEaten >= CONFIG.broccoliEatenLimit){
          if (score < 0) score = 0;
          hudScore.textContent = score;
          return 'you ate too many broccolis :(';
        }
      }
    } else {
      it.flying = true;
      it.touchedBaby = true;
      ricochet(it);
    }
  }
  if (score < 0) score = 0;
  // Completing a level (reaching the level's points target) advances the
  // difficulty; this repeats forever, each level a step faster and needing 5%
  // more points than the last. levelUp() resets the counter.
  if (score >= pointsToAdvance()){
    levelUp();
  }
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
  if (levelFlashTimer > 0) levelFlashTimer -= dt;  // fades the level-name flash

  const target = babyHandPos();
  const sp = currentSpeed();
  const swatting = holding || swatHoldTimer > 0;
  for (const it of items){
    if (it.resolved) continue;

    if (it.flying){
      // swatted/rejected item: travels on its own velocity, spinning, no re-resolve
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
  // charge the buff: each clean second adds a meter segment; any loss of
  // energy/points elsewhere calls loseCharge() and cancels the attempt.
  if (charging){
    chargeTimer += dt;
    if (chargeTimer >= CONFIG.powerupChargeTime) activatePowerup();
    updatePowerMeter();
  }
  const modeLabel = barrageTimer > 0
    ? '⚠️ BARRAGE!'
    : powerupTimer > 0
      ? '★ ' + Math.ceil(powerupTimer) + 's'
      : charging
        ? '⚡ ' + Math.min(Math.round(CONFIG.powerupChargeTime), Math.floor(chargeTimer))
            + '/' + Math.round(CONFIG.powerupChargeTime)
        : swatting ? 'SWATTING' : 'CATCHING';
  if (hudMode.textContent !== modeLabel) hudMode.textContent = modeLabel;
  if (yuckTimer    > 0) yuckTimer    -= dt;
  if (powerupTimer > 0){
    powerupTimer -= dt;
    if (powerupTimer <= 0){
      // buff just ended: wipe the board so the player gets a beat to reset
      // (the baby also drops back to its left-edge home next frame), and hold
      // off the next spawn by one normal interval for the breather.
      powerupTimer = 0;
      items = [];
      spawnTimer = currentSpawnInterval();
    }
  }
}

function render(){
  // clear the whole device buffer (identity transform)
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // map drawing into the fixed virtual world: scaled & centered to fit.
  ctx.setTransform(scale*DPR,0,0,scale*DPR, offX*DPR, offY*DPR);
  ctx.save();
  // clip to the playfield so off-screen spawns and the letterbox margins
  // stay clean.
  ctx.beginPath(); ctx.rect(0,0,VW,VH); ctx.clip();
  // power-up party: the background recolours and disco lights play while the
  // buff is active, easing out over the final second so it doesn't snap off.
  // Both run before sprites, so only the background changes colour.
  const party = powerupTimer > 0 ? Math.min(1, powerupTimer) : 0;
  ART.background(ctx, VW, VH, elapsed, party);
  if (party > 0){
    ART.disco(ctx, VW, VH, elapsed, party);
  }

  const baby = babyPos();
  for (const it of items){
    if (it.resolved) continue;
    if (it.flying){
      if (it.type==='powerup'){
        ART.powerup(ctx, it.x, it.y, it.r, it.rot || 0);
      } else {
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot || 0);
        if (it.peeled) ART.bananaPeeled(ctx, 0, 0, it.r);
        else           ART.broccoli(ctx, 0, 0, it.r);
        ctx.restore();
      }
    } else if (it.type==='powerup'){
      ART.powerup(ctx, it.x, it.y, it.r, it.rot || 0);
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
    // The calm 'neutral' pose appears ONLY when the board is empty — i.e. the
    // screen has just been cleared (power-up ended, or a level-up knocked the
    // field down and the pieces have tumbled off). Whenever any food is on
    // screen the baby stays in the engaged 'catch' pose, ready to reach.
    face = items.length === 0 ? 'neutral' : 'catch';
  }
  const babyScale = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
  ART.baby(ctx, baby.x, baby.y, swatting, face, babyScale);
  // new-level name flashes then fades over the centre while play continues
  if (levelFlashTimer > 0){
    ART.levelFlash(ctx, VW, VH, level, levelFlashTimer, CONFIG.levelFlashTime);
  }
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
  loseCharge();                         // hide the charge meter
  document.getElementById('goReason').textContent = reason;
  document.getElementById('finalStats').textContent =
    'Level ' + level + ' reached · ' + bananasEaten + ' bananas eaten';
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

/* TESTING MODE: caching is disabled so every refresh loads fresh from the
   server. Unregister any previously-installed service worker and clear all
   caches. (Re-enable PWA caching after testing.) */
if ('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister())).catch(()=>{});
}
if (window.caches){
  caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(()=>{});
}
