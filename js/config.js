/* ============================================================
   BANANAS & BROCCOLI — CONFIG
   ------------------------------------------------------------
   Every tunable gameplay number lives here. To rebalance the
   game, edit this file only. Exposed as a global `CONFIG` so
   art.js and engine.js (loaded after this file) can read it.
   ============================================================ */
const CONFIG = {
  // FIXED VIRTUAL WORLD (design resolution). All gameplay positions are
  // expressed in these coordinates and never change, so resizing the
  // browser only uniformly scales the world to fit the screen
  // (letterboxed) — relative positions of every object stay identical.
  // 19.5:9 landscape (1560×720). Desktop renders this fixed world scaled to
  // the window; phones scale it to fill the display.
  worldW:           1560,
  worldH:           720,

  // world — items TRAVEL horizontally from the right edge toward the baby
  baseSpeed:        450,    // px/sec along the aim line; the speed during level 1
  maxSpeed:         1200,   // hard ceiling the per-level speed curve eases toward
  // Difficulty progresses by LEVEL, not by elapsed time: speed is CONSTANT
  // within a level and only steps up when the player completes one (reaches
  // pointsPerLevel). Each step eases toward maxSpeed on a curve, so the
  // increments shrink as the speed climbs. Smaller tau = bigger early jumps.
  // speed(level) = maxSpeed - (maxSpeed-baseSpeed)*e^(-(level-1)/tau).
  levelSpeedTau:    5,      // levels: time-constant of the per-level speed curve
  pointsPerLevel:   100,    // points that complete a level; reaching it resets the
                            // score to 1 and advances to the next (faster) level.
                            // Play is continuous — the field is knocked down, not
                            // frozen — when a level begins.
  spawnEveryStart:  0.70,   // seconds between spawn BURSTS during level 1
  spawnEveryMin:    0.28,   // fastest spawn interval (reached at high levels)
  spawnRampPerLevel: 0.04,  // how much the spawn interval tightens each level
  broccoliChance:   0.333,  // fraction of spawns that are broccoli
                            // (the rest are bananas, so ≈ 2× as many bananas)

  // each spawn is a BURST of burstMin–burstMax items thrown together. Some are
  // decoys aimed to MISS the baby (fly past above/below) — visual noise the
  // player must read past.
  burstMin:         2,      // min items per burst
  burstMax:         3,      // max items per burst
  decoyChance:      0.45,   // chance any given item in a burst is a decoy
  decoyMissOffset:  140,    // px above/below baby a decoy is aimed (must
                            // exceed resolveRadius so it cleanly misses)

  // baby (the player) sits near the LEFT edge. The sprite is anchored by
  // its HEAD center at (babyHeadX, babyHeadY); incoming items resolve at the
  // baby's reaching hand, (babyHeadX+babyHandDX, babyHeadY+babyHandDY).
  babyHeadX:        180,    // px: on-screen x of the baby's head center
  babyHeadY:        315,    // px: vertical anchor; each pose's figure center is
                            // placed babyFigCenter below this, so the figure
                            // sits centred on screen (315+45 = 360 = VH/2)
  babyFigCenter:    45,     // px the figure center sits below the anchor y
  babyHeadPx:       108,    // target on-screen head height (uniform across poses)
  babyHandDX:       64,     // px right of head center where items are caught
  babyHandDY:       18,     // px below head center where items are caught
  // gentle idle motion: the baby drifts up/down a few px at random about its
  // centred origin (eases toward a fresh random target every reseed interval).
  babyBobAmp:       16,     // px: max drift from the origin
  babyBobEase:      2.2,    // per-second approach rate toward the current target
  babyBobReseedMin: 0.7,    // s: min time before a new random target is picked
  babyBobReseedMax: 1.6,    // s: max time before a new random target is picked
  catchAnticipateDist: 520, // baby lunges (catch pose) when a real item is
                            // within this many px of its head; else stands neutral
  // FOUR fixed launch points on the right edge. Each point is DEDICATED to a
  // single food type, so a given launch height always throws the same food.
  // yFrac is the spawn height as a fraction of world height. Two banana and
  // two broccoli points, interleaved top-to-bottom.
  spawnPoints: [
    { yFrac: 0.18, type: 'banana'   },
    { yFrac: 0.40, type: 'broccoli' },
    { yFrac: 0.60, type: 'banana'   },
    { yFrac: 0.82, type: 'broccoli' },
  ],
  itemRadius:       34,     // collision + draw size
  resolveRadius:    50,     // distance from baby at which an item resolves

  // scoring
  pointsPerBanana:    2,    // points for catching a banana (×2 again while powered up)
  penaltyPoints:      0,    // points lost for eating a broccoli
  bananaSwatPenalty:  1,    // points lost for swatting a banana away (NOT a loss)
  broccoliEatenLimit: 10,   // eating this many broccoli total = game over

  // staggering — try to avoid two real items reaching the baby at the
  // same instant, which is unfair/unreadable. New incoming items get a
  // small launch delay nudged until their predicted arrival is at least
  // minArrivalGap away from every other incoming item's arrival.
  minArrivalGap:    0.22,   // seconds of clearance we aim for between hits
  arrivalDelayStep: 0.10,   // how much delay we add per nudge
  maxArrivalDelay:  0.9,    // never hold an item back longer than this

  // RULES (single source of truth, mirrored in resolve()):
  //  - Banana    + released (catching)  => +pointsPerBanana (×2 while powered up)
  //  - Banana    + holding  (rejecting) => -bananaSwatPenalty; banana flies off
  //                                        half-peeled (and costs a life at 0 pts)
  //  - Broccoli  + holding  (swatting)  => safe, swatted away (good)
  //  - Broccoli  + released (eaten)     => costs a life toward broccoliEatenLimit
  //                                        (but scores like a banana while powered up)
  //  - Disco ball+ released (caught)    => refunds a life and begins the power-up
  //                                        charge (survive powerupChargeTime clean)

  // feel
  swatNudge:        0,      // optional extra speed when swatting (0 = off)
  yuckFaceTime:     0.55,   // seconds the baby looks disgusted after eating broccoli
  swatHoldDuration: 0.18,   // seconds the swat remains active for tapped timing tolerance

  // power-up: a rare sparkling disco ball — while the buff is active it doubles
  // banana points, makes broccoli score like a banana, triples item speed (and
  // spawn rate to match), doubles the baby's size, snaps the baby to dead-centre
  // of the screen, and throws a disco. Lasts powerupDuration seconds, then the
  // board is wiped clear so the player gets a beat to reset. Deliberately rare.
  powerupChance:    0.02,   // fraction of real-item spawns that become powerups
  powerupDuration:  4,      // seconds the buff lasts
  eatFrameTime:     0.30,   // seconds each laughing frame holds while the two
                            // baby-eat poses alternate during the buff
  powerupSpinRate:  3,      // rad/sec the disco ball spins while incoming
  powerupSpeedMult: 3,      // item speed multiplier while the buff is active
  powerupBabyScale: 2,      // baby size multiplier while the buff is active
  // The disco ball is the ONLY trigger: catch it, then survive this many
  // seconds with NO loss of energy (no broccoli eaten) and NO loss of points.
  // A meter fills one segment per second; complete it and the buff activates.
  powerupChargeTime: 3,     // seconds of clean play after the disco ball

  // barrage: a terrifying barrage of broccoli only that is fast and furious.
  barrageMinCooldown: 50,   // seconds minimum between barrages
  barrageDuration:    6,    // seconds the barrage lasts
  barrageSpawnEvery:  0.12, // spawn interval during a barrage (very rapid fire)
  barrageSpeedMult:   1.7,  // speed multiplier for barrage items
  barrageChancePerSec: 0.08, // chance per second to trigger barrage after cooldown

  // sprite sizing — food is drawn from illustrations in assets/.
  // foodSpriteScale: longest side of a food sprite = itemRadius * this.
  foodSpriteScale:  2.8,

  // color (kept for reference; sprites now provide the look)
  bananaFill:       '#ffd23f',
  broccoliFill:     '#5fae46',

  // swatted item ricochet (broccoli swatted away, or banana rejected)
  swatBackSpeed:    520,    // px/sec launch speed of a swatted item
  swatSpinMax:      12,     // max rad/sec spin while flying off
};
