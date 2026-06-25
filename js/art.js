/* ============================================================
   BANANAS & BROCCOLI — ART
   ------------------------------------------------------------
   Pure drawing functions: full-colour sprites for the food and
   baby, a parallax scrolling background, and the lit disco-ball
   power-up plus the disco light show. Replace any function here
   to restyle without touching engine logic. Reads from the global
   CONFIG (config.js must load first); exposed as `ART` for engine.js.
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
  babyEat2:     loadImg('assets/baby_eat2.png'),
  babyYuck:     loadImg('assets/baby_yuck.png'),
  babyNeutral:  loadImg('assets/baby_neutral.png'),
  discoball:    loadImg('assets/discoball.svg'),
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

/* ---- Procedural day / night cycle ------------------------------------- */
function _lerp(a, b, t){ return a + (b - a) * t; }
function _lerpRGB(c1, c2, t){
  return [Math.round(_lerp(c1[0], c2[0], t)),
          Math.round(_lerp(c1[1], c2[1], t)),
          Math.round(_lerp(c1[2], c2[2], t))];
}
function _rgb(c, a){
  return a == null ? 'rgb('  + c[0] + ',' + c[1] + ',' + c[2] + ')'
                   : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}

// Sky gradient keyframes around the clock — phase 0 dawn, .25 noon, .5 dusk,
// .75 midnight, then wrapping back to dawn. Each stop holds [top, mid, bottom]
// RGB bands, interpolated continuously so the sky never snaps between states.
const _SKY_KEYS = [
  { p:0.00, top:[120,138,186], mid:[236,182,166], bot:[250,214,176] }, // dawn
  { p:0.25, top:[207,232,245], mid:[227,242,251], bot:[238,247,240] }, // day
  { p:0.50, top:[ 74, 72,120], mid:[226,123, 96], bot:[250,182,120] }, // dusk
  { p:0.75, top:[ 14, 18, 44], mid:[ 24, 30, 62], bot:[ 38, 46, 82] }, // night
];
function _skyAt(phase){
  const keys = _SKY_KEYS, n = keys.length;
  for (let i = 0; i < n; i++){
    const a = keys[i], b = keys[(i + 1) % n];
    const bp = (i + 1 < n) ? b.p : b.p + 1.0;   // wrap night → dawn
    if (phase >= a.p && phase < bp){
      const t = (phase - a.p) / (bp - a.p);
      return { top:_lerpRGB(a.top, b.top, t),
               mid:_lerpRGB(a.mid, b.mid, t),
               bot:_lerpRGB(a.bot, b.bot, t) };
    }
  }
  return { top:keys[0].top, mid:keys[0].mid, bot:keys[0].bot };
}

// Darken/blue a scenery colour toward night so hills and clouds settle into
// dusk alongside the sky. `night` is 0 (day) … 1 (deep night).
const _NIGHT_TINT = [20, 26, 54];
function _nightShade(c, night){ return _lerpRGB(c, _NIGHT_TINT, night * 0.72); }

// Procedural star field, generated once from a fixed seed so the stars hold
// still (only their twinkle animates) across the upper half of the sky.
function _mkStars(seed, count){
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out = [];
  for (let i = 0; i < count; i++){
    out.push({ x: rnd(), y: rnd() * 0.58, r: 0.6 + rnd() * 1.6,
               ph: rnd() * Math.PI * 2, sp: 1.4 + rnd() * 2.6 });
  }
  return out;
}
const _STARS = _mkStars(0x9e3779b1, 70);

// Recolour a sprite to a target hue on a cached offscreen canvas, keeping the
// sprite's own shading (luminosity) and transparency. Uses the 'color' blend
// mode then re-masks with 'destination-in' so the result is the same shape as
// the source, just a different colour. Returns the offscreen canvas.
let _tintCanvas = null;
function _tintSprite(img, hue){
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!_tintCanvas) _tintCanvas = document.createElement('canvas');
  const c = _tintCanvas;
  if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
  const o = c.getContext('2d');
  o.globalCompositeOperation = 'source-over';
  o.clearRect(0, 0, w, h);
  o.drawImage(img, 0, 0);                 // original sprite
  o.globalCompositeOperation = 'color';   // swap hue/sat, keep luminosity
  o.fillStyle = 'hsl(' + hue + ',100%,50%)';
  o.fillRect(0, 0, w, h);
  o.globalCompositeOperation = 'destination-in';
  o.drawImage(img, 0, 0);                 // re-mask to sprite alpha (no box)
  o.globalCompositeOperation = 'source-over';
  return c;
}

// The sun: a warm core wrapped in a soft halo.
function _sun(ctx, x, y, rad, core, glow, alpha){
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const halo = ctx.createRadialGradient(x, y, rad*0.4, x, y, rad*3.4);
  halo.addColorStop(0, _rgb(glow, 0.55));
  halo.addColorStop(1, _rgb(glow, 0));
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, rad*3.4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = _rgb(core);
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

// The moon: pale disc, soft halo, a few faint craters.
function _moon(ctx, x, y, rad, alpha){
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const halo = ctx.createRadialGradient(x, y, rad*0.5, x, y, rad*3.4);
  halo.addColorStop(0, 'rgba(220,228,255,0.40)');
  halo.addColorStop(1, 'rgba(220,228,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(x, y, rad*3.4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#eef2ff';
  ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(196,205,235,0.55)';
  ctx.beginPath(); ctx.arc(x - rad*0.30, y - rad*0.18, rad*0.22, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + rad*0.26, y + rad*0.10, rad*0.16, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + rad*0.05, y + rad*0.34, rad*0.12, 0, Math.PI*2); ctx.fill();
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
  eating2: { hcx:322.8, hcy:280.1, headH:560.2, fcy:511.1 },
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

  banana(ctx, x, y, r){
    ART.sprite(ctx, IMG.banana, x, y, r * CONFIG.foodSpriteScale);
  },

  // A banana that's been swatted/rejected — the half-peeled illustration.
  bananaPeeled(ctx, x, y, r){
    ART.sprite(ctx, IMG.bananaPeeled, x, y, r * CONFIG.foodSpriteScale);
  },

  // Broccoli sprite. While the power-up buff is active the broccoli is
  // harmless, so it's drawn in "disco" mode: its own pixels are recoloured to a
  // flashing, hue-cycling colour and given a matching glow. The recolour is
  // done on an offscreen canvas with the 'color' blend mode (keeps the
  // broccoli's shading, only swaps the hue) and re-masked to the sprite's alpha
  // — so the colour stays inside the silhouette and it works on every browser
  // (including mobile Safari, where ctx.filter is unreliable).
  broccoli(ctx, x, y, r, disco){
    const size = r * CONFIG.foodSpriteScale;
    if (!disco){
      ART.sprite(ctx, IMG.broccoli, x, y, size);
      return;
    }
    const img = IMG.broccoli;
    if (!img.complete || !img.naturalWidth){ return; }
    const t   = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const hue = Math.floor((t * 200) % 360);     // fast cycle = flashing
    const tinted = _tintSprite(img, hue);
    const k = size / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    const rad = size * 0.5;
    // ---- pulsing glow halo behind, in the same hue (circular gradient, fades
    // to fully transparent — no box)
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.4 + 0.25 * Math.sin(t * 8);
    const halo = ctx.createRadialGradient(0, 0, rad * 0.4, 0, 0, rad * 1.5);
    halo.addColorStop(0, 'hsla(' + hue + ',100%,60%,' + pulse.toFixed(3) + ')');
    halo.addColorStop(1, 'hsla(' + hue + ',100%,60%,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, rad * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // ---- the recoloured broccoli (alpha-masked to its own shape)
    ctx.drawImage(tinted, x - w/2, y - h/2, w, h);
  },

  // The baby, drawn from full-colour cartoon sprites (black hair, blue
  // onesie). face: 'neutral' | 'catch' | 'swat' | 'eating' | 'yuck'. The
  // head is pinned over (x,y) at a uniform size; the reaching hand lands
  // toward the RIGHT, where incoming items resolve.
  baby(ctx, x, y, swatting, face, scale){
    face = face || (swatting ? 'swat' : 'neutral');
    let img, meta;
    if (face === 'eating'){
      // power-up: alternate the two laughing frames a few times a second for a
      // lively buff. Each frame carries its own head metrics so the head stays
      // pinned at the same on-screen size/position as they swap.
      const tt = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
      const alt = Math.floor(tt / CONFIG.eatFrameTime) % 2 === 1;
      img  = alt ? IMG.babyEat2 : IMG.babyEat;
      meta = alt ? BABY_META.eating2 : BABY_META.eating;
    } else {
      img = face === 'yuck'   ? IMG.babyYuck
          : (face === 'swat' || swatting) ? IMG.babySwat
          : face === 'catch'  ? IMG.babyCatch
          : IMG.babyNeutral;
      meta = BABY_META[face] || BABY_META.neutral;
    }
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

  // Parallax scenery. `party` (0..1) is the power-up buff strength: while it's
  // active the whole BACKGROUND is washed with cycling disco colours. This runs
  // before any sprites are drawn, so only the background recolours — the baby
  // and food keep their true colours.
  background(ctx, w, h, t, party){
    // Procedural day/night cycle. `phase` runs 0→1 once per cycle: 0 dawn,
    // .25 noon, .5 dusk, .75 midnight. `elev` is the sun's elevation (sine of
    // the phase), split into a daylight strength and a night strength that
    // drive the sky, the celestial body, the stars and the scenery shading.
    const cycle = CONFIG.dayNightCycleSec || 120;
    const phase = ((t / cycle) % 1 + 1) % 1;
    const elev  = Math.sin(phase * Math.PI * 2);
    const daylight = Math.max(0, elev);
    const night    = Math.max(0, -elev);

    // sky gradient, continuously interpolated between the cycle keyframes
    const skyC = _skyAt(phase);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0,    _rgb(skyC.top));
    sky.addColorStop(0.55, _rgb(skyC.mid));
    sky.addColorStop(1,    _rgb(skyC.bot));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // stars fade in with the night and twinkle gently
    if (night > 0.01){
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (const st of _STARS){
        const tw = 0.55 + 0.45 * Math.sin(t * st.sp + st.ph);
        ctx.globalAlpha = night * tw;
        ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }

    // sun (first half of the cycle) or moon (second half), arcing horizon to
    // horizon and fading out as it dips toward the skyline.
    const horizon = h * 0.66, arc = h * 0.54;
    if (phase < 0.5){
      const ps = phase / 0.5;                         // 0 sunrise … 1 sunset
      const sx = w * (0.06 + 0.88 * ps);
      const sy = horizon - Math.sin(ps * Math.PI) * arc;
      const a  = Math.max(0, Math.min(1, Math.sin(ps * Math.PI) * 1.6));
      const core = _lerpRGB([255,176,116], [255,250,214], Math.min(1, daylight * 1.4));
      _sun(ctx, sx, sy, 46, core, [255,214,150], a);
    } else {
      const pm = (phase - 0.5) / 0.5;                 // 0 moonrise … 1 moonset
      const mx = w * (0.06 + 0.88 * pm);
      const my = horizon - Math.sin(pm * Math.PI) * arc;
      const a  = Math.max(0, Math.min(1, Math.sin(pm * Math.PI) * 1.6));
      _moon(ctx, mx, my, 38, a);
    }

    // drifting clouds (drawn behind the hills so peaks overlap them), tinted
    // toward night: [xfrac, yfrac, sizefrac, speed, alpha]
    const cloudC = _lerpRGB([255,255,255], [70,78,110], night * 0.72);
    const clouds = [
      [0.10, 0.16, 0.060, 12, 0.85],
      [0.42, 0.10, 0.085, 20, 0.92],
      [0.72, 0.20, 0.052, 16, 0.80],
      [0.90, 0.30, 0.070, 26, 0.88],
      [0.25, 0.32, 0.045, 30, 0.75],
    ];
    const span = w * 1.4;                       // wrap width (off-screen margin)
    for (const [xf, yf, sf, spd, al] of clouds){
      let cx = (xf*w - t*spd) % span;
      if (cx < -0.3*w) cx += span;
      _cloud(ctx, cx, yf*h, sf*Math.min(w,h*1.4)*2.2, _rgb(cloudC, al));
    }
    // layers: far misty → mid forest → near hills (washed-out pastels),
    // each shaded toward night so the scenery dims with the sky.
    _bgLayer(ctx, w, h, t *  18, h*0.52, 155, _rgb(_nightShade([205,221,234], night)), 0.50);
    _bgLayer(ctx, w, h, t *  46, h*0.60, 135, _rgb(_nightShade([188,217,196], night)), 1.73);

    // Draw scrolling palm trees sitting on the distant hill. They can't be
    // recoloured, so fade them into the darkened hill at night instead.
    if (IMG.palmTrees && IMG.palmTrees.complete && IMG.palmTrees.naturalWidth) {
      const pw = IMG.palmTrees.naturalWidth * 0.15; // smaller scale for distance
      const ph = IMG.palmTrees.naturalHeight * 0.15;
      const pSpacing = w * 0.35; // closer spacing for distant objects
      const pScroll = (t * 46) % pSpacing; // sync speed exactly with the t*46 hill layer
      ctx.save();
      ctx.globalAlpha = 1 - night * 0.6;
      for (let px = -pScroll; px < w; px += pSpacing) {
        // Find exact height of the terrain at this x-coordinate so the tree sits firmly on the hill
        const hillY = _mtY(px + t * 46 + pw / 2, h*0.60, 135, 1.73);
        ctx.drawImage(IMG.palmTrees, px, hillY - ph + 5, pw, ph);
      }
      ctx.restore();
    }

    _bgLayer(ctx, w, h, t *  90, h*0.70, 100, _rgb(_nightShade([174,212,180], night)), 3.21);
    // foreground hills
    _bgLayer(ctx, w, h, t * 140, h*0.79, 55, _rgb(_nightShade([156,203,166], night)), 6.10);

    // power-up: recolour the whole background with a shifting disco wash. Drawn
    // here (before sprites) so the scenery changes colour but sprites do not.
    party = Math.max(0, Math.min(1, party || 0));
    if (party > 0){
      const hue = (t * 80) % 360;
      const wash = ctx.createLinearGradient(0, 0, 0, h);
      wash.addColorStop(0,   'hsla(' + hue + ',85%,60%,' + (0.55 * party).toFixed(3) + ')');
      wash.addColorStop(0.5, 'hsla(' + ((hue + 60) % 360) + ',85%,55%,' + (0.45 * party).toFixed(3) + ')');
      wash.addColorStop(1,   'hsla(' + ((hue + 140) % 360) + ',85%,55%,' + (0.55 * party).toFixed(3) + ')');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);
    }
  },

  // Disco-ball power-up — an SVG mirror-tiled sphere lit with FAUX LIGHTING:
  // the facets spin (rotated by `rot`), but the shading is light-fixed — a
  // soft ambient halo, a curved sheen, a bright specular hot-spot up-and-left,
  // a cool rim light opposite it, and twinkling glints catching the mirrors —
  // so the ball reads as a glossy 3-D sphere shining under a fixed light.
  powerup(ctx, x, y, r, rot){
    const size = r * CONFIG.foodSpriteScale;
    const rad  = size * 0.5;
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const img = IMG.discoball;

    // ---- light-fixed underlay: ambient glow halo behind the ball
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, rad * 0.6, 0, 0, rad * 1.7);
    const hp = 0.35 + 0.15 * Math.sin(t * 5);          // gentle pulse
    halo.addColorStop(0, 'rgba(210,240,255,' + hp.toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(210,240,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(0, 0, rad * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // ---- the spinning mirror sphere
    if (img.complete && img.naturalWidth){
      const k = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * k, h = img.naturalHeight * k;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot || 0);
      ctx.drawImage(img, -w/2, -h/2, w, h);
      ctx.restore();
    }

    // ---- light-fixed shading (does NOT rotate with the facets)
    ctx.save();
    ctx.translate(x, y);
    // clip to the sphere so highlights wrap the surface, not the air
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    // broad sheen biased toward the light (upper-left)
    const lx = -rad * 0.38, ly = -rad * 0.38;
    const sheen = ctx.createRadialGradient(lx, ly, 0, lx, ly, rad * 1.25);
    sheen.addColorStop(0,   'rgba(255,255,255,0.55)');
    sheen.addColorStop(0.5, 'rgba(220,245,255,0.18)');
    sheen.addColorStop(1,   'rgba(220,245,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(-rad, -rad, size, size);
    // tight specular hot-spot that shimmers
    const hot = 0.7 + 0.3 * Math.sin(t * 9);
    const spec = ctx.createRadialGradient(lx, ly, 0, lx, ly, rad * 0.32);
    spec.addColorStop(0, 'rgba(255,255,255,' + (0.95 * hot).toFixed(3) + ')');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath(); ctx.arc(lx, ly, rad * 0.32, 0, Math.PI * 2); ctx.fill();
    // cool rim light on the far (lower-right) edge
    const rim = ctx.createRadialGradient(rad * 0.55, rad * 0.55, rad * 0.2,
                                         rad * 0.55, rad * 0.55, rad * 0.9);
    rim.addColorStop(0, 'rgba(140,200,255,0)');
    rim.addColorStop(0.75, 'rgba(150,210,255,0.18)');
    rim.addColorStop(1, 'rgba(190,230,255,0.42)');
    ctx.fillStyle = rim;
    ctx.fillRect(-rad, -rad, size, size);
    ctx.restore();

    // ---- twinkling glints catching individual mirror tiles
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const glints = 7;
    for (let i=0; i<glints; i++){
      const ang = (i / glints) * Math.PI * 2 + i * 1.3;
      const dist = rad * (0.22 + 0.6 * ((i * 0.37) % 1));
      const gx = Math.cos(ang) * dist, gy = Math.sin(ang) * dist;
      const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 2.1);   // 0..1 twinkle
      const gr = rad * (0.05 + 0.12 * tw);
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0,   'rgba(255,255,255,' + (0.85 * tw).toFixed(3) + ')');
      g.addColorStop(0.4, 'rgba(190,235,255,' + (0.40 * tw).toFixed(3) + ')');
      g.addColorStop(1,   'rgba(190,235,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  },

  // DISCO! Background accent drawn (before the sprites) while the buff is
  // active: rotating coloured light beams fanning down from a top-centre mirror
  // ball, plus scattered twinkling sparkles. The overall colour change lives in
  // background()'s disco wash; this only adds the beams/sparkles behind the
  // sprites. `f` is 0..1 buff fade (eases the party in/out at the buff's edges).
  disco(ctx, w, h, t, f){
    f = Math.max(0, Math.min(1, f == null ? 1 : f));
    if (f <= 0) return;
    const hues = [0, 45, 120, 195, 280, 320];     // red, amber, green, cyan, violet, pink
    ctx.save();
    // rotating light beams fanning down from the top-centre mirror ball
    const ox = w * 0.5, oy = -h * 0.06;
    const beams = hues.length;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < beams; i++){
      const ang = t * 0.6 + (i / beams) * Math.PI * 2;       // sweep
      const spread = 0.16;
      const a1 = ang - spread, a2 = ang + spread;
      const reach = Math.hypot(w, h) * 1.2;
      const x1 = ox + Math.cos(a1) * reach, y1 = oy + Math.sin(a1) * reach;
      const x2 = ox + Math.cos(a2) * reach, y2 = oy + Math.sin(a2) * reach;
      const flick = 0.12 + 0.10 * (0.5 + 0.5 * Math.sin(t * 4 + i * 1.7));
      const hue = hues[i % hues.length];
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, reach);
      g.addColorStop(0,   'hsla(' + hue + ',100%,65%,' + (flick * f).toFixed(3) + ')');
      g.addColorStop(0.6, 'hsla(' + hue + ',100%,60%,' + (flick * 0.5 * f).toFixed(3) + ')');
      g.addColorStop(1,   'hsla(' + hue + ',100%,60%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
    }
    // scattered twinkling floor sparkles
    const sparks = 22;
    for (let i = 0; i < sparks; i++){
      const sx = ((i * 73.13) % 1) * w;
      const sy = (0.35 + 0.6 * ((i * 39.7) % 1)) * h;
      const tw = 0.5 + 0.5 * Math.sin(t * 7 + i * 2.3);
      const sr = (3 + 5 * tw) * (0.6 + 0.4 * f);
      const hue = hues[i % hues.length];
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      g.addColorStop(0, 'hsla(' + hue + ',100%,85%,' + (0.9 * tw * f).toFixed(3) + ')');
      g.addColorStop(1, 'hsla(' + hue + ',100%,85%,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  // New-level name that fades in then out at the centre of the play area WITHOUT
  // pausing play. Deliberately QUIET — small, semi-transparent and barely glowing
  // so it reads as a gentle cue, not a loud, distracting interruption. `timer`
  // counts down from `total`.
  levelFlash(ctx, w, h, level, timer, total){
    total = total || 1;
    const p = Math.max(0, Math.min(1, 1 - timer / total));   // 0..1 through the cue
    // alpha: ease up over the first 20%, then fade out across the rest, and cap
    // it low so the label never dominates the screen.
    const rise = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
    const alpha = Math.max(0, Math.min(1, rise)) * 0.45;
    if (alpha <= 0) return;
    const pop = Math.min(1, p / 0.25);                       // soft grow-in
    const scale = 0.92 + 0.08 * (1 - Math.pow(1 - pop, 3));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 80px "Comic Neue", "Comic Sans MS", cursive';
    ctx.lineJoin = 'round';
    // faint glow only
    ctx.shadowColor = 'rgba(255,210,63,0.45)';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeText('LEVEL ' + level, 0, 0);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('LEVEL ' + level, 0, 0);
    ctx.restore();
  }
};
