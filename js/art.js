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
  banana:       loadImg('assets/banana.webp'),
  bananaPeeled: loadImg('assets/banana_peeled.webp'),
  broccoli:     loadImg('assets/broccoli.webp'),
  palmTrees:    loadImg('assets/palm_trees.webp'),
  babyCatch:    loadImg('assets/baby_catch.png'),
  babySwat:     loadImg('assets/baby_swat.png'),
  babyEat:      loadImg('assets/baby_eat.png'),
  babyYuck:     loadImg('assets/baby_yuck.png'),
  babyNeutral:  loadImg('assets/baby_neutral.png'),
};

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
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let sx = 0; sx <= w + 3; sx += 3) {
    ctx.lineTo(sx, _mtY(sx + scroll, baseY, amp, seed));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
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

// Per-pose anchor metrics in each sprite's own natural-pixel coordinates:
// the head bounding-box center (hcx,hcy), head height (headH), and figure
// vertical center (fcy). Every pose is drawn at a uniform on-screen head
// size (CONFIG.babyHeadPx); horizontally the head center is pinned to the
// anchor x, and vertically the figure center (fcy) is placed a uniform
// distance (CONFIG.babyFigCenter) below the anchor y — so poses with more
// or less leg in frame all stay vertically centred the same way.
const BABY_META = {
  catch:   { hcx:178.5, hcy:153.0, headH:294, fcy:274.5 },
  swat:    { hcx:168.0, hcy:151.5, headH:303, fcy:284.5 },
  eating:  { hcx:174.0, hcy:151.0, headH:302, fcy:275.5 },
  yuck:    { hcx:158.5, hcy:144.5, headH:277, fcy:284.5 },
  neutral: { hcx:164.5, hcy:151.0, headH:302, fcy:306.5 },
};

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

  // The baby, drawn from full-colour cartoon sprites (black hair, blue
  // onesie). face: 'neutral' | 'catch' | 'swat' | 'eating' | 'yuck'. The
  // head is pinned over (x,y) at a uniform size; the reaching hand lands
  // toward the RIGHT, where incoming items resolve.
  baby(ctx, x, y, swatting, face, scale){
    face = face || (swatting ? 'swat' : 'neutral');
    const img = face === 'eating' ? IMG.babyEat
              : face === 'yuck'   ? IMG.babyYuck
              : (face === 'swat' || swatting) ? IMG.babySwat
              : face === 'catch'  ? IMG.babyCatch
              : IMG.babyNeutral;
    const meta = BABY_META[face] || BABY_META.neutral;
    if (!img.complete || !img.naturalWidth) return;
    const s = (CONFIG.babyHeadPx / meta.headH) * (scale || 1);  // uniform head size
    // head center pinned horizontally; figure center placed babyFigCenter
    // below the anchor y so every pose stays vertically centred the same way.
    const ox = x - meta.hcx*s;
    const oy = y + CONFIG.babyFigCenter*(scale || 1) - meta.fcy*s;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;                // smooth cartoon edges
    ctx.drawImage(img, ox, oy, img.naturalWidth*s, img.naturalHeight*s);
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
    
    // Draw scrolling palm trees sitting on the distant hill
    if (IMG.palmTrees && IMG.palmTrees.complete && IMG.palmTrees.naturalWidth) {
      const pw = IMG.palmTrees.naturalWidth * 0.15; // smaller scale for distance
      const ph = IMG.palmTrees.naturalHeight * 0.15;
      const pSpacing = w * 0.35; // closer spacing for distant objects
      const pScroll = (t * 46) % pSpacing; // sync speed exactly with the t*46 hill layer
      ctx.save();
      for (let px = -pScroll; px < w; px += pSpacing) {
        // Find exact height of the terrain at this x-coordinate so the tree sits firmly on the hill
        const hillY = _mtY(px + t * 46 + pw / 2, h*0.60, 135, 1.73);
        ctx.drawImage(IMG.palmTrees, px, hillY - ph + 5, pw, ph);
      }
      ctx.restore();
    }

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
