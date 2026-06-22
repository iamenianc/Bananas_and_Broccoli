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

function _palm(ctx, x, y, size){
  ctx.save();
  ctx.strokeStyle = '#7fae89';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x + size*0.12, y - size*0.35,
                    x + size*0.18, y - size*0.70,
                    x + size*0.06, y - size);
  ctx.stroke();
  const tx = x + size*0.06, ty = y - size;
  ctx.lineWidth = Math.max(1, size * 0.05);
  for (const [fx, fy] of [[-0.9,-0.35],[-0.55,-0.65],[-0.1,-0.75],
                           [ 0.45,-0.65],[ 0.85,-0.35],[0.5,-0.05],[-0.45,-0.05]]){
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + fx*size*0.5, ty + fy*size*0.5 + size*0.05,
                         tx + fx*size,     ty + fy*size);
    ctx.stroke();
  }
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
  baby(ctx, x, y, swatting, face){
    face = face || (swatting ? 'swat' : 'catch');
    const img = face === 'eating' ? IMG.babyEat
              : face === 'yuck'   ? IMG.babyYuck
              : (face === 'swat' || swatting) ? IMG.babySwat
              : IMG.babyCatch;
    if (!img.complete || !img.naturalWidth) return;
    const g = BABY_GRID, s = CONFIG.babyPixel;       // canvas px per sprite px
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
    // layers: far misty → mid forest → near hills (washed-out pastels)
    _bgLayer(ctx, w, h, t *  18, h*0.52, 155, '#cdddea', 0.50);
    _bgLayer(ctx, w, h, t *  46, h*0.60, 135, '#bcd9c4', 1.73);
    _bgLayer(ctx, w, h, t *  90, h*0.70, 100, '#aed4b4', 3.21);
    // foreground hills + palm trees
    const fgTw = w * 2, fgBase = h*0.79, fgAmp = 55, fgSeed = 6.10;
    const fgOff = ((t * 140 % fgTw) + fgTw) % fgTw;
    _bgLayer(ctx, w, h, t * 140, fgBase, fgAmp, '#9ccba6', fgSeed);
    for (const frac of [0.08, 0.24, 0.40, 0.55, 0.71, 0.87]){
      const lx = frac * fgTw;
      for (const wrap of [0, fgTw]){
        const sx = lx - fgOff + wrap;
        if (sx > -90 && sx < w + 90)
          _palm(ctx, sx, _mtY(lx, fgBase, fgAmp, fgSeed), h * 0.13);
      }
    }
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
