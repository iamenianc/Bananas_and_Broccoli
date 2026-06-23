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
  // 16:9 landscape. Desktop renders this fixed world scaled to the window;
  // phones scale it to fill the display.
  worldW:           1280,
  worldH:           720,

  // world — items now TRAVEL horizontally from the right edge toward the baby
  baseSpeed:        450,    // px/sec along the aim line, at start (increased from 300)
  accelPerSec:      22,     // speed gained each second alive (increased from 11)
  maxSpeed:         1200,   // increased from 1000
  spawnEveryStart:  0.70,   // seconds between spawn BURSTS at start (decreased from 1.05)
  spawnEveryMin:    0.28,   // fastest spawn interval (decreased from 0.42)
  spawnRampPerSec:  0.012,  // how fast spawn interval tightens
  broccoliChance:   0.444,  // fraction of spawns that are broccoli
                            // (=> 25% more bananas than broccoli: 0.556 vs 0.444)

  // each spawn is a BURST of 1-3 items thrown together. Some are decoys
  // aimed to MISS the baby (fly past above/below) — visual noise the
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
  babyHeadY:        315,    // px: head-center y — chosen so the whole figure
                            // sits vertically centred on screen (it extends
                            // ~45px below the head center at this scale)
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
  spawnYJitter:     0.7,    // items spawn anywhere in middle 70% of height
  itemRadius:       34,     // collision + draw size
  resolveRadius:    50,     // distance from baby at which an item resolves

  // scoring
  pointsPerBanana:    1,
  penaltyPoints:      1,    // points lost for eating a broccoli
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
  //  - Banana + released (catching) => +point
  //  - Banana + holding  (rejecting) => -3 points, banana flies off half-peeled
  //  - Broccoli + holding (swatting) => safe, swatted away (good)
  //  - Broccoli + released (eaten)   => -1 point, and counts toward the
  //                                     6-broccoli lose condition

  // feel
  swatNudge:        0,      // optional extra speed when swatting (0 = off)
  happyFaceTime:    0.45,   // seconds the baby looks happy after catching a banana
  yuckFaceTime:     0.55,   // seconds the baby looks disgusted after eating broccoli
  swatHoldDuration: 0.18,   // seconds the swat remains active for tapped timing tolerance

  // power-up: a rare pink banana — catching it doubles banana points, makes
  // broccoli harmless, triples item speed, and doubles the baby's size for
  // powerupDuration seconds. Deliberately rare.
  powerupChance:    0.02,   // fraction of real-item spawns that become powerups
  powerupDuration:  6,      // seconds the buff lasts
  powerupSpinRate:  3,      // rad/sec the pink banana spins while incoming
  powerupSpeedMult: 3,      // item speed multiplier while the buff is active
  powerupBabyScale: 2,      // baby size multiplier while the buff is active
  streakForPowerup: 20,     // consecutive bananas caught that triggers the buff

  // barrage: a terrifying barrage of broccoli only that is fast and furious.
  barrageMinCooldown: 50,   // seconds minimum between barrages
  barrageDuration:    6,    // seconds the barrage lasts
  barrageSpawnEvery:  0.12, // spawn interval during barrage (decreased from 0.18)
  barrageSpeedMult:   1.7,  // speed multiplier for barrage items
  barrageChancePerSec: 0.08, // chance per second to trigger barrage after cooldown

  // sprite sizing — food/spoon are drawn from PNG illustrations in assets/.
  // foodSpriteScale: longest side of a food sprite = itemRadius * this.
  foodSpriteScale:  2.8,

  // color (kept for reference; sprites now provide the look)
  bananaFill:       '#ffd23f',
  broccoliFill:     '#5fae46',

  // swatted item ricochet (broccoli swatted away, or banana rejected)
  swatBackSpeed:    520,    // px/sec launch speed of a swatted item
  swatSpinMax:      12,     // max rad/sec spin while flying off


};
