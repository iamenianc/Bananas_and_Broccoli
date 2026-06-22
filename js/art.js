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

  // The baby. face: 'catch' | 'swat' | 'eating'
  baby(ctx, x, y, swatting, face){
    face = face || (swatting ? 'swat' : 'catch');
    ART.wobble(ctx, c=>{
      const r = 40;
      // head
      c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.stroke();
      // eyes — happy squint when eating, dots otherwise
      if (face === 'eating'){
        c.beginPath(); c.arc(x-13, y-4, 7, Math.PI, 0, true); c.stroke();   // ^ ^
        c.beginPath(); c.arc(x+13, y-4, 7, Math.PI, 0, true); c.stroke();
        // happy cheeks
        c.beginPath(); c.arc(x-22, y+8, 4, 0, Math.PI*2); c.stroke();
        c.beginPath(); c.arc(x+22, y+8, 4, 0, Math.PI*2); c.stroke();
      } else {
        c.fillStyle='#000';
        c.beginPath(); c.arc(x-13, y-6, 2.5, 0, Math.PI*2); c.fill();
        c.beginPath(); c.arc(x+13, y-6, 2.5, 0, Math.PI*2); c.fill();
      }
      // mouth
      c.beginPath();
      if (face === 'eating'){
        // big happy open mouth (filled), like a delighted munch
        c.arc(x, y+10, 13, 0, Math.PI);
        c.fillStyle = '#000'; c.fill();
      } else if (face === 'swat'){
        c.arc(x, y+12, 9, Math.PI, 0);                     // tight, concentrating
        c.stroke();
      } else {
        c.arc(x, y+8, 11, 0, Math.PI);                     // open, ready
        c.stroke();
      }
      // curl of hair
      c.beginPath(); c.arc(x, y-r, 6, Math.PI*0.2, Math.PI*0.9); c.stroke();
      // hands reach toward the RIGHT (incoming items)
      const hx = x + r + 14;
      if (swatting){
        // raised fists, ready to swat
        c.beginPath(); c.moveTo(hx-18, y-22); c.lineTo(hx, y-30); c.stroke();
        c.beginPath(); c.moveTo(hx-18, y+22); c.lineTo(hx, y+30); c.stroke();
        c.beginPath(); c.arc(hx, y-30, 7, 0, Math.PI*2); c.stroke();
        c.beginPath(); c.arc(hx, y+30, 7, 0, Math.PI*2); c.stroke();
      } else {
        // open cupped hands, ready to catch
        c.beginPath(); c.arc(hx-2, y-18, 9, -Math.PI*0.5, Math.PI*0.5); c.stroke();
        c.beginPath(); c.arc(hx-2, y+18, 9, -Math.PI*0.5, Math.PI*0.5); c.stroke();
      }
    });
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
