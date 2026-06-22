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
  babyCatch:    loadImg('assets/baby_catch.svg'),
  babySwat:     loadImg('assets/baby_swat.svg'),
  babyEat:      loadImg('assets/baby_eat.svg'),
  babyYuck:     loadImg('assets/baby_yuck.svg'),
};

/* ---- parallax background helpers ---- */
function _mtY(lx, baseY, amp, seed){
  const v =
    Math.sin(lx * 0.0028 + seed)        * 0.42 +
    Math.sin(lx * 0.0073 + seed * 2.1)  * 0.26 +
    Math.sin(lx * 0.0160 + seed * 3.7)  * 0.17 +
    Math.sin(lx * 0.0340 + seed * 5.9)  * 0.10 +
    Math.sin(lx * 0.0700 + seed * 8.3)  * 0.05;
  return baseY - Math.max(0, (v + 1) * 0.5) * amp;
}

function _bgLayer(ctx, w, h, scroll, baseY, amp, color, seed){
  const tw  = w * 2;
  const off = ((scroll % tw) + tw) % tw;
  // draw up to 2 tiles to cover the full viewport with no seam artefact
  for (let tile = 0; tile <= 1; tile++){
    const tl = tile * tw - off;          // screen x of this tile's left edge
    const tr = tl + tw;
    if (tr < 0 || tl > w) continue;
    const x0 = Math.max(0, tl), x1 = Math.min(w, tr);
    ctx.beginPath();
    ctx.moveTo(x0, h);
    for (let sx = x0; sx <= x1; sx += 3)
      ctx.lineTo(sx, _mtY(sx - tl, baseY, amp, seed));
    ctx.lineTo(x1, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// A soft puffy cloud built from overlapping circles. (cx,cy) is the cloud
// center; size is its overall radius. Drawn in a single flat fill colour.
function _cloud(ctx, cx, cy, size, color){
  ctx.save();
  ctx.fillStyle = color;
  // lobes: [dx, dy, r] relative to size — a classic cumulus silhouette
  const lobes = [[-0.95,0.10,0.55],[-0.45,-0.25,0.70],[0.15,-0.35,0.78],
                 [0.70,-0.10,0.62],[1.05,0.15,0.45],
                 [-0.35,0.30,0.55],[0.45,0.30,0.55]];
  for (const [dx, dy, r] of lobes){
    ctx.beginPath();
    ctx.arc(cx + dx*size, cy + dy*size, r*size, 0, Math.PI*2);
    ctx.fill();
  }
  // flat-ish base so the cloud reads as floating, not a blob
  ctx.beginPath();
  ctx.ellipse(cx + 0.05*size, cy + 0.42*size, 1.15*size, 0.4*size, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// Pixel-art baby sprite metrics (must match tools/gen_baby.py grid): the
// head center sits at (cx,cy) in the 24x20 grid, so we can anchor the head
// over the baby's logical position while the hands extend to the right.
const BABY_GRID = { w:30, h:22, cx:9.5, cy:10.7 };

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
  // eyes). face: 'catch' | 'swat' | 'eating' | 'yuck'. The head is anchored
  // over (x,y); hands reach toward the RIGHT (incoming items).
  baby(ctx, x, y, swatting, face, scale){
    face = face || (swatting ? 'swat' : 'catch');
    const img = face === 'eating' ? IMG.babyEat
              : face === 'yuck'   ? IMG.babyYuck
              : (face === 'swat' || swatting) ? IMG.babySwat
              : IMG.babyCatch;
    if (!img.complete || !img.naturalWidth) return;
    const g = BABY_GRID, s = CONFIG.babyPixel * (scale || 1);  // canvas px per sprite px
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;               // crisp pixel-art edges
    ctx.drawImage(img, x - g.cx*s, y - g.cy*s, g.w*s, g.h*s);
    ctx.imageSmoothingEnabled = prev;
  },

  background(ctx, w, h, t){
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,    '#cfe8f5');
    sky.addColorStop(0.55, '#e3f2fb');
    sky.addColorStop(1,    '#eef7f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.arc(w*0.78, h*0.13, 52, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,252,225,0.30)'; ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.78, h*0.13, 36, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,250,210,0.70)'; ctx.fill();
    ctx.restore();
    // drifting clouds (drawn behind the hills so peaks overlap them):
    // [xfrac, yfrac, sizefrac, speed, color]
    const clouds = [
      [0.10, 0.16, 0.060, 12, 'rgba(255,255,255,0.85)'],
      [0.42, 0.10, 0.085, 20, 'rgba(255,255,255,0.92)'],
      [0.72, 0.20, 0.052, 16, 'rgba(255,255,255,0.80)'],
      [0.90, 0.30, 0.070, 26, 'rgba(255,255,255,0.88)'],
      [0.25, 0.32, 0.045, 30, 'rgba(255,255,255,0.75)'],
    ];
    const span = w * 1.4;                       // wrap width (off-screen margin)
    for (const [xf, yf, sf, spd, col] of clouds){
      let cx = (xf*w - t*spd) % span;
      if (cx < -0.3*w) cx += span;
      _cloud(ctx, cx, yf*h, sf*Math.min(w,h*1.4)*2.2, col);
    }
    // layers: far misty → mid forest → near hills (washed-out pastels)
    _bgLayer(ctx, w, h, t *  18, h*0.52, 155, '#cdddea', 0.50);
    _bgLayer(ctx, w, h, t *  46, h*0.60, 135, '#bcd9c4', 1.73);
    _bgLayer(ctx, w, h, t *  90, h*0.70, 100, '#aed4b4', 3.21);
    // foreground hills
    _bgLayer(ctx, w, h, t * 140, h*0.79, 55, '#9ccba6', 6.10);
  },

  // Pink banana power-up — the normal banana sprite with a hot-pink tint overlay.
  powerup(ctx, x, y, r){
    if (!IMG.banana.complete || !IMG.banana.naturalWidth) return;
    const size = r * CONFIG.foodSpriteScale;
    const k = size / Math.max(IMG.banana.naturalWidth, IMG.banana.naturalHeight);
    const w = IMG.banana.naturalWidth * k, h = IMG.banana.naturalHeight * k;
    ctx.save();
    ctx.translate(x, y);
    // draw banana normally, then overlay pink using source-atop so the tint
    // follows the sprite's shape (transparent pixels stay transparent).
    ctx.drawImage(IMG.banana, -w/2, -h/2, w, h);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255, 100, 180, 0.55)';
    ctx.fillRect(-w/2, -h/2, w, h);
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
