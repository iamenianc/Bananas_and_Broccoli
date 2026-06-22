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
  baseSpeed:        300,    // px/sec along the aim line, at start
  accelPerSec:      11,     // speed gained each second alive
  maxSpeed:         1000,
  spawnEveryStart:  1.05,   // seconds between spawn BURSTS at start
  spawnEveryMin:    0.42,   // fastest spawn interval
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

  // baby (the player) sits at the LEFT edge, vertically centered.
  babyXFromLeft:    90,     // px in from left edge — items resolve here
  spawnYJitter:     0.7,    // items spawn anywhere in middle 70% of height
  itemRadius:       34,     // collision + draw size
  resolveRadius:    50,     // distance from baby at which an item resolves

  // scoring
  pointsPerBanana:    1,
  penaltyPoints:      1,    // points lost for eating a broccoli
  bananaSwatPenalty:  3,    // points lost for swatting a banana away (NOT a loss)
  broccoliEatenLimit: 6,    // eating this many broccoli total = game over

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

  // sprite sizing — food/spoon are drawn from PNG illustrations in assets/.
  // foodSpriteScale: longest side of a food sprite = itemRadius * this.
  foodSpriteScale:  2.8,
  // baby is a 16-bit pixel-art SVG (assets/baby_*.svg); canvas px per
  // sprite pixel. ~6 makes a nice big head (~100px across).
  babyPixel:        6,

  // color (kept for reference; sprites now provide the look)
  bananaFill:       '#ffd23f',
  broccoliFill:     '#5fae46',

  // swatted item ricochet (broccoli swatted away, or banana rejected)
  swatBackSpeed:    520,    // px/sec launch speed of a swatted item
  swatSpinMax:      12,     // max rad/sec spin while flying off

  // spoon launcher — a spoon flicks in from the right edge to fling each
  // item into play. Purely cosmetic, timed to when the item enters.
  spoonDur:          0.30,  // seconds the flick animation lasts
  spoonSize:         46,    // overall spoon scale
  spoonSpriteScale:  3.2,   // longest side of spoon sprite = spoonSize * this
  spoonBaseAngle:   -2.36,  // rad: orients the sprite so its bowl faces left
  spoonWindAngle:    0.95,  // rad: wound-back start angle (added to base)
  spoonFlickAngle:  -0.75,  // rad: flicked-forward end angle (added to base)
};
