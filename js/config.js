/* ============================================================
   BANANAS & BROCCOLI — CONFIGURATION MENU
   ------------------------------------------------------------
   Every tunable gameplay setting lives here, grouped by category.
   Exposed as a global `CONFIG` object for art.js and engine.js.
   ============================================================ */

const CONFIG = {
  // ==========================================
  // 1. SYSTEM & VIEWPORT RESOLUTION
  // ==========================================
  worldW: 1560,             // Fixed virtual world width (landscape aspect ratio)
  worldH: 720,              // Fixed virtual world height
  moveZoneFrac: 0.4,        // Left fraction of screen used as touch flap pad (right 60% is swat/catch)
  dayNightCycleSec: 100,    // Seconds for one full procedural day→night→day cycle

  // ==========================================
  // 2. BABY CHARACTER (PLAYER) MOVEMENT & STATS
  // ==========================================
  babyHeadX: 360,           // Head x anchor position (closer to screen center)
  babyHeadY: 315,           // Vertical anchor; positions baby centered in the play area
  babyFigCenter: 45,        // Pixels the baby figure center sits below anchor y
  babyHeadPx: 108,          // Target on-screen head height (uniform across poses)

  // Hitbox offsets (world px from baby anchor y)
  hitTopDY: -58,            // Top of the head boundary
  hitBotDY: 70,             // Shoulders boundary (bottom of regular hitbox)

  // Flappy physics & bounds
  babyMoveMin: 160,         // Ceiling: highest the baby's head center can reach
  babyMoveMax: 430,         // Floor baseline: where the baby rests under gravity
  gravity: 1100,            // Downward gravitational acceleration (px/sec^2)
  flapImpulse: 560,         // Upward speed impulse added per tap (px/sec)
  flapRiseMax: 1000,        // Maximum cap on upward speed when taps are chained
  maxFallSpeed: 800,        // Terminal fall velocity cap (px/sec)

  // Anticipation & animations
  catchAnticipateDist: 520, // Distance (px) at which baby lunges (catch pose) for incoming items
  yuckFaceTime: 0.55,       // Duration (sec) baby looks disgusted after eating broccoli
  swatHoldDuration: 0.18,   // Duration (sec) swat pose remains active for tapped timing tolerance
  swatNudge: 0,             // Extra speed bonus when swatting (0 = off)

  // Unused historical variables (bobbing logic removed from code)
  babyBobAmp: 16,           // Max drift amplitude from origin
  babyBobEase: 2.2,         // Easing approach rate to target drift
  babyBobReseedMin: 0.7,    // Min duration before picking a new drift target
  babyBobReseedMax: 1.6,    // Max duration before picking a new drift target

  // ==========================================
  // 3. ITEMS PHYSICS & COLLISION
  // ==========================================
  itemRadius: 34,           // Radius (px) for collision bounds and baseline drawing size
  resolveRadius: 50,        // Distance from baby's column at which collision resolves
  swatBackSpeed: 520,       // Ricochet launch speed (px/sec) when item is swatted/rejected
  swatSpinMax: 12,          // Maximum spin rate (rad/sec) of a ricocheting item

  // Staggering (spacing out incoming items to avoid overlapping hits)
  minArrivalGap: 0.22,      // Minimum arrival separation (sec) between homing items
  arrivalDelayStep: 0.10,   // Delay step (sec) added per nudge to resolve arrival conflicts
  maxArrivalDelay: 0.9,     // Maximum total delay cap (sec) allowed for staggering

  // ==========================================
  // 4. GAMEPLAY PROGRESSION (LEVELS & DIFFICULTY)
  // ==========================================
  pointsPerLevel: 88,       // Score required to complete Level 1
  levelPointsGrowth: 1.1,  // Exponential target score growth per level
  levelFlashTime: 1.4,      // Duration (sec) the new level banner flashes at center
  baseSpeed: 680,         // Initial item travel speed (px/sec) at Level 1
  maxSpeed: 1800,           // Absolute ceiling speed that progression eases toward
  levelSpeedTau: 4.5,         // Progression curvature rate (smaller = faster speed growth)
  spawnEveryStart: 0.60,    // Initial spawn interval (sec) during Level 1
  spawnEveryMin: 0.28,      // Fastest possible spawn interval at high levels
  spawnRampPerLevel: 0.04,  // Decrement to spawn interval per level increase

  // ==========================================
  // 5. FOOD SPAWNS & LANES
  // ==========================================
  broccoliChance: 0.20,     // Fraction of spawns that are broccoli (rest are bananas)
  burstMin: 3,              // Minimum items spawned per burst
  burstMax: 5,              // Maximum items spawned per burst
  decoyChance: 0.45,        // Chance any given item in a burst is a decoy (aims to miss)
  decoyMissOffset: 140,     // Offset (px) above/below baby to guarantee a decoy miss
  bananaSpawnMargin: 40,    // Height offset (px) beyond baby bounds bananas can spawn at
  bananaDriftMaxDeg: 3,     // Max flight tilt angle (degrees) off horizontal for bananas
  bananaMaxSpawnDelay: 0.40,// Max delay (sec) to stagger banana launches within a burst

  // Fixed horizontal lanes on the right edge
  spawnPoints: [
    { yFrac: 0.18, type: 'banana' },
    { yFrac: 0.40, type: 'broccoli' },
    { yFrac: 0.60, type: 'banana' },
    { yFrac: 0.82, type: 'broccoli' },
  ],

  // ==========================================
  // 6. SCORING, LIVES & COOLDOWNS
  // ==========================================
  pointsPerBanana: 2,       // Points awarded for eating a banana
  bananaSwatPenalty: 2,     // Score deducted when swatting a banana away (points only — no life loss)
  penaltyPoints: 0,         // Score deducted when eating broccoli
  broccoliTapPoints: 2,     // Points awarded for swatting broccoli away with a precise TAP
  broccoliEatenLimit: 8,   // Total damage allowed before Game Over (life bar capacity)
  bananaLifeRestorePct: 0.01,// Life restoration fraction (percentage of limit) per banana eaten

  // ==========================================
  // 7. SPECIAL GAME EVENTS
  // ==========================================

  // Power-Up Mode (Disco Ball)
  powerupChance: 0.02,      // Fraction of item spawns that turn into disco balls
  powerupDuration: 6,       // Active duration (sec) of the power-up buff
  powerupChargeTime: 3,     // Clean play time (sec) required to charge the buff after catch
  powerupLifeRestore: 2,    // Life points restored immediately on catch
  powerupSpeedMult: 1.6,    // Item speed multiplier during active power-up
  powerupBabyScale: 2,      // Baby scale multiplier during active power-up
  powerupSpinRate: 3,       // Rotation speed (rad/sec) of the disco ball item
  eatFrameTime: 0.30,       // Duration (sec) each chewing pose frame is held
  powerCentreEase: 12,      // Historical easing speed to screen center (unused)

  // Broccoli Barrage
  barrageMinCooldown: 50,   // Min delay (sec) between random barrages
  barrageDuration: 3,       // Active duration (sec) of a barrage
  barrageSpawnEvery: 0.12,  // Rapid spawn rate (sec) of broccoli during barrage
  barrageSpeedMult: 1.7,    // Speed multiplier of items during barrage
  barrageChancePerSec: 0.08,// Probability per second of triggering a barrage after cooldown

  // Broccoli Volley
  volleyChance: 0.06,       // Probability of triggering a volley on any spawn tick
  volleyCount: 3,           // Number of broccoli items launched in the volley
  volleySpeedMult: 2,       // Speed multiplier of volley items
  volleyGap: 0.17,          // Launch gap (sec) between successive volley items

  // ==========================================
  // 8. VISUAL ASSETS STYLING
  // ==========================================
  foodSpriteScale: 2.4,     // Scaling multiplier for drawn item sprites
  bananaFill: '#ffd23f',     // Fallback color for banana vector fills
  broccoliFill: '#5fae46',  // Fallback color for broccoli vector fills
};
