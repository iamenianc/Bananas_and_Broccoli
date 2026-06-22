/* ============================================================
   BANANAS & BROCCOLI — ART
   ------------------------------------------------------------
   Pure drawing functions. Hand-drawn black-on-white, no effects.
   Replace any function here to restyle without touching engine
   logic. Reads fills from the global CONFIG (config.js must load
   first). Exposed as a global `ART` for engine.js.
   ============================================================ */
// Preloaded sprite images (full-colour illustrations). They start loading
// immediately; until ready, ART.sprite() simply skips drawing that frame.
function loadImg(src){ const i = new Image(); i.src = src; return i; }
const IMG = {
  banana:       loadImg('assets/banana.png'),
  bananaPeeled: loadImg('assets/banana_peeled.png'),
  broccoli:     loadImg('assets/broccoli.png'),
  spoon:        loadImg('assets/spoon.png'),
  babyCatch:    loadImg('assets/baby_catch.svg'),
  babySwat:     loadImg('assets/baby_swat.svg'),
  babyEat:      loadImg('assets/baby_eat.svg'),
};

// Pixel-art baby sprite metrics (must match tools/gen_baby.py grid): the
// head center sits at (cx,cy) in the 24x20 grid, so we can anchor the head
// over the baby's logical position while the hands extend to the right.
const BABY_GRID = { w:24, h:20, cx:8.5, cy:9 };

const ART = {
  stroke: 3,

  // Draw a sprite centered at (x,y), scaled so its longest side == size,
  // aspect-preserved. No-op until the image has loaded.
  sprite(ctx, img, x, y, size){
    if (!img.complete || !img.naturalWidth) return;
    const k = size / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, x - w/2, y - h/2, w, h);
  },

  wobble(ctx, fn){
    ctx.save();
    ctx.lineWidth = ART.stroke;
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    fn(ctx);
    ctx.restore();
  },

  banana(ctx, x, y, r){
    ART.sprite(ctx, IMG.banana, x, y, r * CONFIG.foodSpriteScale);
  },

  // A banana that's been swatted/rejected — the half-peeled illustration.
  bananaPeeled(ctx, x, y, r){
    ART.sprite(ctx, IMG.bananaPeeled, x, y, r * CONFIG.foodSpriteScale);
  },

  broccoli(ctx, x, y, r){
    ART.sprite(ctx, IMG.broccoli, x, y, r * CONFIG.foodSpriteScale);
  },

  // The baby, drawn from 16-bit pixel-art SVG sprites (black hair, brown
  // eyes). face: 'catch' | 'swat' | 'eating'. The head is anchored over
  // (x,y); hands reach toward the RIGHT (incoming items).
  baby(ctx, x, y, swatting, face){
    face = face || (swatting ? 'swat' : 'catch');
    const img = face === 'eating' ? IMG.babyEat
              : (face === 'swat' || swatting) ? IMG.babySwat
              : IMG.babyCatch;
    if (!img.complete || !img.naturalWidth) return;
    const g = BABY_GRID, s = CONFIG.babyPixel;       // canvas px per sprite px
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;               // crisp pixel-art edges
    ctx.drawImage(img, x - g.cx*s, y - g.cy*s, g.w*s, g.h*s);
    ctx.imageSmoothingEnabled = prev;
  },

  // The spoon sprite used to fling food into play. Pivot is at (x,y) —
  // placed at the right edge. `angle` is the flick rotation; a base angle
  // turns the source illustration so its bowl points into the playfield.
  spoon(ctx, x, y, angle){
    if (!IMG.spoon.complete || !IMG.spoon.naturalWidth) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + CONFIG.spoonBaseAngle);
    ART.sprite(ctx, IMG.spoon, 0, 0, CONFIG.spoonSize * CONFIG.spoonSpriteScale);
    ctx.restore();
  },

  catchZone(ctx, x, y, r){
    ART.wobble(ctx, c=>{
      c.setLineDash([10,12]);
      c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.stroke();
    });
  }
};
