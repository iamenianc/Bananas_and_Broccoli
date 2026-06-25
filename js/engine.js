/* ============================================================
   BANANAS & BROCCOLI — ENGINE
   ------------------------------------------------------------
   Spawning, physics, input, scoring and the main loop. Depends
   on the globals from config.js (CONFIG) and art.js (ART), which
   must be loaded before this file.
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hudProgress = document.getElementById('progressFill');
const hudMode = document.getElementById('mode');
const hudBroccoli = document.getElementById('broccoli');
const hudPower = document.getElementById('power');
const hudLevel = document.getElementById('level');

// The game is drawn in the FIXED virtual world (CONFIG.worldW x worldH).
// On resize we only recompute how that fixed world is scaled & centered to
// fit the actual screen — the world coordinates themselves never change, so
// the relative position of every object is unaffected by window resizing.
const VW = CONFIG.worldW, VH = CONFIG.worldH;
let DPR = 1, scale = 1, offX = 0, offY = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth, cssH = window.innerHeight;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * DPR);
  canvas.height = Math.round(cssH * DPR);
  // "contain" fit: uniformly scale the world to fit, then center it.
  scale = Math.min(cssW / VW, cssH / VH);
  offX = (cssW - VW * scale) / 2;
  offY = (cssH - VH * scale) / 2;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const State = { MENU: 'menu', PLAY: 'play', OVER: 'over' };
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
let yuckTimer = 0;    // >0 while baby shows the disgusted-broccoli face
let powerupTimer = 0;    // >0 while power-up buff is active (baby shows the eat face)
let charging = false;    // true while charging the buff after catching the disco ball
let chargeTimer = 0;     // seconds of clean play accumulated toward the buff
let lastPowerFilled = -1;// last segment count rendered in the power meter
let powerVisible = false;// last visibility state of the power meter
let barrageTimer = 0;    // >0 while barrage is active
let timeSinceLastBarrage = 50; // seconds since last barrage ended
let lastBroccoliEaten = 0; // tracking for HUD flash checks
let lastT = 0;
// player vertical movement (FLAPPY): the baby's head-center y plus a velocity.
// Gravity pulls it down each frame; a tap flaps an upward impulse.
let babyCtrlY = CONFIG.babyMoveMax; // current head-center y; starts on the floor
let babyVelY = 0;                  // vertical velocity (px/sec, + = downward)
let swatPointerId = null;            // pointerId currently held in the swat zone

function reset() {
  items = []; score = 0; level = 1; bananasEaten = 0; levelFlashTimer = CONFIG.levelFlashTime;
  elapsed = 0; spawnTimer = 0;
  holding = false; swatHoldTimer = 0; broccoliEaten = 0; yuckTimer = 0; powerupTimer = 0;
  charging = false; chargeTimer = 0;
  barrageTimer = 0;
  lastBroccoliEaten = 0;
  timeSinceLastBarrage = 50;
  babyCtrlY = CONFIG.babyMoveMax; babyVelY = 0; swatPointerId = null;
  updateProgressHud();
  updateBroccoliHud();
  updatePowerMeter();
  updateLevelHud();
}

// Show which difficulty level we're on in the corner.
function updateLevelHud() {
  if (hudLevel) hudLevel.textContent = 'LEVEL ' + level;
}

// Points needed to complete the CURRENT level. The target grows 5% per level:
// target(level) = pointsPerLevel * levelPointsGrowth^(level-1), rounded.
function pointsToAdvance() {
  return Math.round(CONFIG.pointsPerLevel *
    Math.pow(CONFIG.levelPointsGrowth, level - 1));
}

// Fill the progress bar (horizontal, under the health bar) to reflect how far
// the score has climbed toward the current level's points target (0..100%).
function updateProgressHud() {
  if (!hudProgress) return;
  const pct = Math.max(0, Math.min(100, (score / pointsToAdvance()) * 100));
  hudProgress.style.width = pct + '%';
}

// Advance to the next level: bump difficulty and reset the per-level score to 1.
// Play is CONTINUOUS — no freeze — but every banana/broccoli on the field is
// knocked down so the board clears as the next, faster level begins. An active
// power-up buff or in-progress charge carries over (it is NOT cancelled).
function levelUp() {
  level++;
  score = 1;
  // An active power-up buff and any in-progress charge are intentionally LEFT
  // RUNNING across a level-up — leveling up no longer cancels the power-up.
  levelFlashTimer = CONFIG.levelFlashTime;  // flash the new level's name
  updateLevelHud();
}

// ---- power-up charge: catch the disco ball, then survive powerupChargeTime
// seconds without taking broccoli damage (eating a broccoli). The meter fills
// one segment per second; only broccoli damage cancels the attempt.
function startCharge() {
  if (powerupTimer > 0 || charging) return;   // not while already buffed / charging
  charging = true; chargeTimer = 0;
  updatePowerMeter();
}
function loseCharge() {
  if (!charging) return;
  charging = false; chargeTimer = 0;
  updatePowerMeter();
}
function activatePowerup() {
  powerupTimer = CONFIG.powerupDuration;
  charging = false; chargeTimer = 0;
  updatePowerMeter();
}

// Render the charge meter: one segment per second of powerupChargeTime, the
// elapsed seconds lit. Hidden entirely unless a charge is in progress.
function updatePowerMeter() {
  if (charging !== powerVisible) {
    hudPower.classList.toggle('show', charging);
    powerVisible = charging;
    if (!charging) { hudPower.innerHTML = ''; lastPowerFilled = -1; }
  }
  if (!charging) return;
  const total = Math.round(CONFIG.powerupChargeTime);
  const filled = Math.max(0, Math.min(total, Math.floor(chargeTimer)));
  if (filled === lastPowerFilled) return;
  lastPowerFilled = filled;
  let html = '';
  for (let i = 0; i < total; i++) html += '<span class="p' + (i < filled ? ' on' : '') + '"></span>';
  hudPower.innerHTML = html;
}

// Render lives as a row of segments — one per life point. The row empties from
// the right as life is spent; because life is fractional (broccoli costs a whole
// point, a banana restores 1%), the boundary segment fades to show the partial.
function updateBroccoliHud() {
  const limit = CONFIG.broccoliEatenLimit;
  const remaining = Math.max(0, limit - broccoliEaten);
  const full = Math.floor(remaining + 1e-9);     // whole life points still lit
  const partial = remaining - full;              // 0..1 fraction in the next seg
  let html = '';
  for (let i = 0; i < limit; i++) {
    if (i < full) {
      html += '<span class="b left"></span>';
    } else if (i === full && partial > 0) {
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

function babyPos() {
  // The baby keeps its fixed x even while powered up; at the 2× buff scale the
  // figure still clears every edge of the playfield. Vertically it flaps under
  // gravity (babyCtrlY).
  return { x: CONFIG.babyHeadX, y: babyCtrlY };
}

// The baby's collision/catch HITBOX: a vertical band from the shoulders up to
// the top of the head, at the head column. Returns its x, top/bottom edges and
// centre y (cy, used as the aim target). The band scales with the baby while
// powered up. Food resolves when it reaches the column and its centre is in
// [top, bot]; food above the head or below the shoulders misses.
function babyHitbox() {
  const s = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
  const p = babyPos();
  const top = p.y + CONFIG.hitTopDY * s;
  const bot = p.y + CONFIG.hitBotDY * s;
  return { x: p.x, top, bot, cy: (top + bot) / 2 };
}

function currentSpeed() {
  // Speed is CONSTANT within a level and steps up each level on a curve that
  // eases toward maxSpeed, so the per-level jumps shrink as the speed climbs.
  let base = CONFIG.maxSpeed -
    (CONFIG.maxSpeed - CONFIG.baseSpeed) * Math.exp(-(level - 1) / CONFIG.levelSpeedTau);
  if (barrageTimer > 0) {
    base *= CONFIG.barrageSpeedMult;
  }
  return base;
}
function currentSpawnInterval() {
  if (barrageTimer > 0) {
    return CONFIG.barrageSpawnEvery;
  }
  let interval = Math.max(CONFIG.spawnEveryMin,
    CONFIG.spawnEveryStart - CONFIG.spawnRampPerLevel * (level - 1));
  return interval;
}

function spawnOne(sy, type, isDecoy, opts) {
  opts = opts || {};
  const speedMult = opts.speedMult || 1;
  const r = CONFIG.itemRadius;
  const sx = VW + r;
  const sp = currentSpeed() * speedMult;

  // BANANAS don't home in on the baby: they launch from the given (random)
  // height and fly almost — but not perfectly — parallel to the x-axis, with a
  // small random up/down tilt. No aim, no decoy, no arrival-staggering — the
  // player must flap to intercept them.
  if (type === 'banana') {
    const ang = (Math.random() * 2 - 1) * CONFIG.bananaDriftMaxDeg * Math.PI / 180;
    const ux = -Math.cos(ang), uy = Math.sin(ang);
    const delay = (opts.delay !== undefined) ? opts.delay : (Math.random() * CONFIG.bananaMaxSpawnDelay);
    items.push({
      x: sx, y: sy, r, type, resolved: false, decoy: false,
      delay, speedMult,
      ux, uy, vx: ux * sp, vy: uy * sp
    });
    return;
  }

  const target = babyHitbox();
  // real items aim at the hitbox centre; decoys aim at a point well above/below
  // the band so they sail past and miss.
  const aimY = isDecoy
    ? target.cy + (Math.random() < 0.5 ? -1 : 1) * CONFIG.decoyMissOffset
    : target.cy;
  const dx = target.x - sx, dy = aimY - sy;
  const len = Math.hypot(dx, dy) || 1;
  // Stagger arrivals: nudge this item's launch delay until its predicted
  // arrival time is clear of every other incoming real item's arrival,
  // so two things rarely reach the baby at the exact same instant. A volley
  // passes an explicit delay (opts.delay) to fire its shots in succession.
  let delay = 0;
  if (opts.delay != null) {
    delay = opts.delay;
  } else if (!isDecoy) {
    const others = incomingArrivals(sp);
    let arrival = len / sp;
    let guard = 0;
    while (delay < CONFIG.maxArrivalDelay && guard++ < 32 &&
      others.some(a => Math.abs(a - arrival) < CONFIG.minArrivalGap)) {
      delay += CONFIG.arrivalDelayStep;
      arrival = delay + len / sp;
    }
  }
  const item = {
    x: sx, y: sy, r, type, resolved: false, decoy: isDecoy, delay, speedMult,
    ux: dx / len, uy: dy / len,
    vx: dx / len * sp, vy: dy / len * sp,
    isVolley: opts.isVolley || false,
    startX: sx
  };
  if (type === 'powerup') { item.rot = 0; item.spin = CONFIG.powerupSpinRate; }
  items.push(item);
}

// Predicted arrival times (seconds from now) of all incoming HOMING items
// (broccoli / power-up), used to space out new spawns so hits don't land
// simultaneously. Bananas don't home at the baby, so they're excluded.
function incomingArrivals(sp) {
  const target = babyHitbox();
  const out = [];
  for (const it of items) {
    if (it.resolved || it.flying || it.decoy || it.type === 'banana') continue;
    const d = Math.hypot(it.x - target.x, it.y - target.cy);
    out.push((it.delay > 0 ? it.delay : 0) + d / sp);
  }
  return out;
}

// A banana's random launch height: anywhere along the vertical axis, a little
// beyond the baby's reachable band on each side (clamped on-screen).
function randomBananaY() {
  const lo = Math.max(CONFIG.itemRadius, CONFIG.babyMoveMin - CONFIG.bananaSpawnMargin);
  const hi = Math.min(VH - CONFIG.itemRadius, CONFIG.babyMoveMax + CONFIG.bananaSpawnMargin);
  return lo + Math.random() * (hi - lo);
}

// Pick one of the fixed launch points dedicated to `type`, preferring a
// point not already used this burst so two items don't stack on the same spot.
function pickSpawnPoint(type, used) {
  const pts = CONFIG.spawnPoints.filter(p => p.type === type);
  const free = pts.filter(p => !used.has(p));
  const pool = free.length ? free : pts;
  const p = pool[Math.floor(Math.random() * pool.length)];
  used.add(p);
  return p;
}

function spawn() {
  // rare event: a volley of broccoli fired in quick succession at double speed
  if (barrageTimer <= 0 && Math.random() < CONFIG.volleyChance) {
    spawnBroccoliVolley();
    return;
  }
  const n = CONFIG.burstMin + Math.floor(Math.random() * (CONFIG.burstMax - CONFIG.burstMin + 1));
  const used = new Set();
  for (let i = 0; i < n; i++) {
    const isDecoy = Math.random() < CONFIG.decoyChance;
    // Decide the food type (preserving the banana/broccoli ratio; bananas
    // occasionally upgrade to the rare power-up).
    let type;
    if (barrageTimer > 0) {
      type = 'broccoli';
    } else if (Math.random() < CONFIG.broccoliChance) {
      type = 'broccoli';
    } else if (!isDecoy && Math.random() < CONFIG.powerupChance) {
      type = 'powerup';
    } else {
      type = 'banana';
    }
    if (type === 'banana') {
      // bananas launch from a random height and fly nearly-horizontal (never
      // decoys — every banana is its own stray target to flap toward).
      spawnOne(randomBananaY(), 'banana', false);
    } else {
      // broccoli / power-up launch from a DEDICATED fixed point and home at the
      // baby (power-ups ride the banana launch heights).
      const baseType = type === 'powerup' ? 'banana' : type;
      const sy = pickSpawnPoint(baseType, used).yFrac * VH;
      spawnOne(sy, type, isDecoy);
    }
  }
}

// A rare broccoli volley: CONFIG.volleyCount broccoli fired straight at the baby
// in quick succession (each held back volleyGap longer than the last) at double
// speed — a sudden flurry the player must swat away in time.
function spawnBroccoliVolley() {
  const used = new Set();
  for (let i = 0; i < CONFIG.volleyCount; i++) {
    const sy = pickSpawnPoint('broccoli', used).yFrac * VH;
    spawnOne(sy, 'broccoli', false, {
      speedMult: CONFIG.volleySpeedMult,
      delay: i * CONFIG.volleyGap,
      isVolley: true
    });
  }
}

// Launch a swatted/rejected item back the way it came (opposite of its
// incoming heading) with a little random spread and spin.
function ricochet(it) {
  const back = Math.atan2(-it.uy, -it.ux);          // opposite direction
  const ang = back + (Math.random() * 2 - 1) * (40 * Math.PI / 180);
  it.vx = Math.cos(ang) * CONFIG.swatBackSpeed;
  it.vy = Math.sin(ang) * CONFIG.swatBackSpeed;
  it.spin = (Math.random() * 2 - 1) * CONFIG.swatSpinMax;
  it.rot = 0;
}

// Resolve an item that reached the baby. Returns reason string if game over.
function resolve(it) {
  const swatting = holding || swatHoldTimer > 0;
  if (it.type === 'powerup') {
    if (swatting) {
      it.flying = true;
      ricochet(it);
    } else {
      it.resolved = true;
      if (broccoliEaten > 0) {
        broccoliEaten = Math.max(0, broccoliEaten - CONFIG.powerupLifeRestore);  // refund health
        updateBroccoliHud();
      }
      startCharge();                    // begin the clean-play charge attempt
    }
  } else if (it.type === 'banana') {
    if (swatting) {
      // Swatting a banana costs POINTS only — it no longer drains a life, so it
      // can never end the game on its own, and it does NOT cancel the disco-ball
      // charge (only taking broccoli damage does that).
      score -= CONFIG.bananaSwatPenalty;
      it.flying = true;
      it.peeled = true;
      ricochet(it);
    } else {
      it.resolved = true;
      score += CONFIG.pointsPerBanana;
      bananasEaten++;                   // one banana eaten (cumulative across levels)
      // eating a banana also restores 1% of the life bar
      if (broccoliEaten > 0) {
        broccoliEaten = Math.max(0, broccoliEaten -
          CONFIG.bananaLifeRestorePct * CONFIG.broccoliEatenLimit);
        updateBroccoliHud();
      }
    }
  } else { // broccoli
    if (!swatting) {
      it.resolved = true;
      if (powerupTimer > 0) {
        // powered up: broccoli is harmless but worth nothing — only bananas
        // count toward points while the buff is active.
      } else {
        score -= CONFIG.penaltyPoints;
        broccoliEaten++;
        loseCharge();                   // taking broccoli damage cancels the charge
        yuckTimer = CONFIG.yuckFaceTime;
        updateBroccoliHud();
        if (broccoliEaten >= CONFIG.broccoliEatenLimit) {
          if (score < 0) score = 0;
          updateProgressHud();
          return 'you ate too many broccolis :(';
        }
      }
    } else {
      // swatted away (good). A precise TAP — finger already released, the swat
      // still active only via the tolerance window — is rewarded with points; a
      // press-and-hold swat (finger still down) is safe but scores nothing.
      if (!holding && swatHoldTimer > 0) score += CONFIG.broccoliTapPoints;
      it.flying = true;
      it.touchedBaby = true;
      ricochet(it);
    }
  }
  if (score < 0) score = 0;
  // Completing a level (reaching the level's points target) advances the
  // difficulty; this repeats forever, each level a step faster and needing 5%
  // more points than the last. levelUp() resets the counter.
  if (score >= pointsToAdvance()) {
    levelUp();
  }
  updateProgressHud();
  return null;
}

function update(dt) {
  elapsed += dt;

  // player vertical movement (FLAPPY): gravity constantly pulls the baby down;
  // taps add an upward impulse via flap() in the input handlers. There is no
  // active "down" input. The baby rests on the floor (babyMoveMax) and bonks the
  // ceiling (babyMoveMin). While powered up the 2× baby is held at screen centre
  // (where the big figure clears every edge); player control resumes after.
  babyVelY = Math.min(babyVelY + CONFIG.gravity * dt, CONFIG.maxFallSpeed);
  babyCtrlY += babyVelY * dt;
  if (babyCtrlY >= CONFIG.babyMoveMax) { babyCtrlY = CONFIG.babyMoveMax; babyVelY = 0; }
  if (babyCtrlY <= CONFIG.babyMoveMin) {
    babyCtrlY = CONFIG.babyMoveMin;
    if (babyVelY < 0) babyVelY = 0;
  }

  if (barrageTimer > 0) {
    barrageTimer -= dt;
    if (barrageTimer <= 0) {
      timeSinceLastBarrage = 0;
    }
  } else {
    timeSinceLastBarrage += dt;
    if (timeSinceLastBarrage >= CONFIG.barrageMinCooldown && powerupTimer <= 0) {
      if (Math.random() < CONFIG.barrageChancePerSec * dt) {
        barrageTimer = CONFIG.barrageDuration;
        spawnTimer = 0; // Trigger an immediate burst
      }
    }
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0) { spawn(); spawnTimer = currentSpawnInterval(); }

  if (swatHoldTimer > 0) swatHoldTimer -= dt;
  if (levelFlashTimer > 0) levelFlashTimer -= dt;  // fades the level-name flash

  const hb = babyHitbox();
  const sp = currentSpeed();
  const swatting = holding || swatHoldTimer > 0;
  for (const it of items) {
    if (it.resolved) continue;

    if (it.flying) {
      // swatted/rejected item: travels on its own velocity, spinning, no re-resolve
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.spin * dt;
      continue;
    }

    // held back briefly to stagger its arrival — wait off-screen
    if (it.delay > 0) { it.delay -= dt; continue; }

    // Gravitational pull: objects close to the baby gravitate toward the hitzone center (broccoli excluded, only before passing the baby's plane)
    if (it.type !== 'broccoli' && it.x > hb.x) {
      const gravRange = 320;
      const gdx = hb.x - it.x;
      const gdy = hb.cy - it.y;
      const gdist = Math.hypot(gdx, gdy) || 1;
      if (gdist < gravRange) {
        let pullForce = 6.5;
        if (powerupTimer > 0) {
          pullForce *= 2.5;
        }
        const pull = (1 - gdist / gravRange) * pullForce * dt;
        const targetUx = gdx / gdist;
        const targetUy = gdy / gdist;
        it.ux += (targetUx - it.ux) * Math.min(1, pull);
        it.uy += (targetUy - it.uy) * Math.min(1, pull);
        const uLen = Math.hypot(it.ux, it.uy) || 1;
        it.ux /= uLen;
        it.uy /= uLen;
      }
    }
    // Volley homing: if it is a volley broccoli and not yet past halfway through its journey
    if (it.isVolley && it.startX && it.x > hb.x + (it.startX - hb.x) * 0.45) {
      const vdx = hb.x - it.x;
      const vdy = hb.cy - it.y;
      const vlen = Math.hypot(vdx, vdy) || 1;
      it.ux = vdx / vlen;
      it.uy = vdy / vlen;
    }

    // incoming item: keep moving along the fixed aim direction. Per-item
    // speedMult keeps volley broccoli flying at their faster pace every frame
    // (not just at launch).
    const speed = sp * (it.speedMult || 1) + (swatting ? CONFIG.swatNudge : 0);
    it.vx = it.ux * speed;
    it.vy = it.uy * speed;
    it.x += it.vx * dt;
    it.y += it.vy * dt;
    if (it.type === 'powerup') it.rot = (it.rot || 0) + it.spin * dt;
    // resolve when it reaches the baby's column (within resolveRadius) AND its
    // centre overlaps the shoulders→top-of-head band; otherwise it sails past
    // above the head / below the shoulders and misses.
    const isPowerup = it.type === 'powerup';
    const scaleFactor = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
    const bottomBound = isPowerup ? (hb.bot + 150 * scaleFactor) : hb.bot;

    if (Math.abs(it.x - hb.x) <= CONFIG.resolveRadius &&
      it.y >= hb.top && it.y <= bottomBound) {
      const reason = resolve(it);
      if (reason) { gameOver(reason); return; }
    }
  }
  // flying banana hitting an incoming broccoli: both tumble off-screen together
  for (const flt of items) {
    if (!flt.flying || flt.type !== 'banana' || flt.hitBroccoli) continue;
    for (const inc of items) {
      if (inc.flying || inc.resolved || inc.type !== 'broccoli') continue;
      if (Math.hypot(flt.x - inc.x, flt.y - inc.y) <= flt.r + inc.r) {
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
  for (const flt of items) {
    if (!flt.flying || flt.type !== 'broccoli' || !flt.touchedBaby) continue;
    for (const inc of items) {
      if (inc.flying || inc.resolved || inc.type !== 'broccoli') continue;
      if (Math.hypot(flt.x - inc.x, flt.y - inc.y) <= flt.r + inc.r) {
        inc.checkedBy = inc.checkedBy || [];
        if (!inc.checkedBy.includes(flt)) {
          inc.checkedBy.push(flt);
          if (Math.random() < 0.5) {
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
    it.x > -120 && it.x < VW + 120 && it.y > -120 && it.y < VH + 120
  );
  // charge the buff: each clean second adds a meter segment; taking broccoli
  // damage calls loseCharge() and cancels the attempt.
  if (charging) {
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
  if (yuckTimer > 0) yuckTimer -= dt;
  if (powerupTimer > 0) {
    powerupTimer -= dt;
    if (powerupTimer <= 0) {
      powerupTimer = 0;
    }
  }
}

function render() {
  // clear the whole device buffer (identity transform)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // map drawing into the fixed virtual world: scaled & centered to fit.
  ctx.setTransform(scale * DPR, 0, 0, scale * DPR, offX * DPR, offY * DPR);
  ctx.save();
  // clip to the playfield so off-screen spawns and the letterbox margins
  // stay clean.
  ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
  // power-up party: the background recolours and disco lights play while the
  // buff is active, easing out over the final second so it doesn't snap off.
  // Both run before sprites, so only the background changes colour.
  const party = powerupTimer > 0 ? Math.min(1, powerupTimer) : 0;
  ART.background(ctx, VW, VH, elapsed, 0);
  if (party > 0) {
    ART.disco(ctx, VW, VH, elapsed, party);
  }

  const baby = babyPos();
  for (const it of items) {
    if (it.resolved) continue;
    if (it.flying) {
      if (it.type === 'powerup') {
        ART.powerup(ctx, it.x, it.y, it.r, it.rot || 0);
      } else {
        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.rot || 0);
        if (it.peeled) ART.bananaPeeled(ctx, 0, 0, it.r);
        else ART.broccoli(ctx, 0, 0, it.r, powerupTimer > 0);
        ctx.restore();
      }
    } else if (it.type === 'powerup') {
      ART.powerup(ctx, it.x, it.y, it.r, it.rot || 0);
    } else if (it.type === 'banana') {
      ART.banana(ctx, it.x, it.y, it.r);
    } else {
      ART.broccoli(ctx, it.x, it.y, it.r, powerupTimer > 0);
    }
  }
  const swatting = holding || swatHoldTimer > 0;
  let face;
  // The eat face is reserved for the power-up: it shows for the whole buff.
  if (powerupTimer > 0) face = 'eating';
  else if (swatting) face = 'swat';
  else if (yuckTimer > 0) face = 'yuck';
  else {
    // The calm 'neutral' pose appears ONLY when the board is empty — i.e. the
    // screen has just been cleared (power-up ended, or a level-up knocked the
    // field down and the pieces have tumbled off).
    // Whenever any food is on screen the baby stays in the engaged 'catch' pose, ready to reach.
    face = items.length === 0 ? 'neutral' : 'catch';
  }
  const babyScale = powerupTimer > 0 ? CONFIG.powerupBabyScale : 1;
  ART.baby(ctx, baby.x, baby.y, swatting, face, babyScale);
  // new-level name flashes then fades over the centre while play continues
  if (levelFlashTimer > 0) {
    ART.levelFlash(ctx, VW, VH, level, levelFlashTimer, CONFIG.levelFlashTime);
  }
  ctx.restore();
}

function loop(t) {
  if (state !== State.PLAY) { return; }
  if (!lastT) lastT = t;
  let dt = (t - lastT) / 1000; lastT = t;
  if (dt > 0.05) dt = 0.05; // clamp big tab-switch gaps
  update(dt);
  if (state === State.PLAY) render();
  requestAnimationFrame(loop);
}

/* ---- state transitions ---- */
function startGame() {
  reset();
  state = State.PLAY;
  document.getElementById('start').classList.add('hidden');
  document.getElementById('gameover').classList.add('hidden');
  lastT = 0;
  requestAnimationFrame(loop);
}
function gameOver(reason) {
  state = State.OVER;
  loseCharge();                         // hide the charge meter
  document.getElementById('goReason').textContent = reason;
  document.getElementById('finalStats').textContent =
    'Level ' + level + ' reached · ' + bananasEaten + ' bananas eaten';
  document.getElementById('gameover').classList.remove('hidden');
}

/* ---- input ----
   Vertical movement is FLAPPY: a tap flaps the baby up (chain taps to climb);
   gravity does the rest. Swat/catch is unchanged (hold = swat, release = catch).
     • Touch  : the LEFT moveZoneFrac of the screen is the flap pad (tap to hop);
                the right part stays the swat/catch area, so two thumbs can flap
                and swat at once.
     • Mouse  : one button does both — each press flaps AND swats, release catches.
     • Keyboard: ↑/W/Space flap; hold ↓/S to swat (release to catch).         */
function beginSwat() {
  holding = true;
  swatHoldTimer = CONFIG.swatHoldDuration;
  yuckTimer = 0;
}
// A tap flaps an upward impulse; chained taps stack toward flapRiseMax so the
// baby climbs flappy-bird style. Ignored while powered up (the baby is centred).
function flap() {
  babyVelY = Math.max(-CONFIG.flapRiseMax, babyVelY - CONFIG.flapImpulse);
}
function down(e) {
  if (state === State.PLAY) {
    if (e.pointerType === 'touch') {
      if (e.clientX < window.innerWidth * CONFIG.moveZoneFrac) {
        flap();                           // left zone: tap to hop
      } else {
        swatPointerId = e.pointerId;      // right zone: this thumb swats/catches
        beginSwat();
      }
    } else {
      flap();                             // mouse/pen: one press both flaps...
      swatPointerId = e.pointerId;        // ...and swats (release to catch)
      beginSwat();
    }
  }
  e.preventDefault();
}
function up(e) {
  if (e.pointerId === swatPointerId) { holding = false; swatPointerId = null; }
  e.preventDefault();
}
canvas.addEventListener('pointerdown', down, { passive: false });
window.addEventListener('pointerup', up, { passive: false });
window.addEventListener('pointercancel', up, { passive: false });

/* keyboard: ↑/W/Space flap; hold ↓/S to swat */
function keydown(e) {
  if (state !== State.PLAY) return;
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W':
    case ' ': case 'Spacebar': if (!e.repeat) flap(); e.preventDefault(); break;
    case 'ArrowDown': case 's': case 'S': beginSwat(); e.preventDefault(); break;
  }
}
function keyup(e) {
  switch (e.key) {
    case 'ArrowDown': case 's': case 'S': holding = false; break;
  }
}
window.addEventListener('keydown', keydown, { passive: false });
window.addEventListener('keyup', keyup);

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('retryBtn').addEventListener('click', startGame);

/* TESTING MODE: caching is disabled so every refresh loads fresh from the
   server. Unregister any previously-installed service worker and clear all
   caches. (Re-enable PWA caching after testing.) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(regs => regs.forEach(r => r.unregister())).catch(() => { });
}
if (window.caches) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => { });
}
