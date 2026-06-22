/* ============================================================
   BANANAS & BROCCOLI — ART
   ------------------------------------------------------------
   Pure drawing functions. Hand-drawn black-on-white, no effects.
   Replace any function here to restyle without touching engine
   logic. Reads fills from the global CONFIG (config.js must load
   first). Exposed as a global `ART` for engine.js.
   ============================================================ */
const ART = {
  stroke: 3,

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
    ART.wobble(ctx, c=>{
      c.beginPath();
      c.moveTo(x - r*0.9, y - r*0.2);
      c.quadraticCurveTo(x - r*0.2, y + r*1.1, x + r*0.95, y - r*0.1);
      c.quadraticCurveTo(x + r*0.2, y + r*0.45, x - r*0.9, y - r*0.2);
      c.closePath();
      c.fillStyle = CONFIG.bananaFill; c.fill();
      c.stroke();
      // tip
      c.beginPath();
      c.moveTo(x - r*0.9, y - r*0.2);
      c.lineTo(x - r*1.05, y - r*0.5);
      c.stroke();
    });
  },

  // A banana that's been swatted/rejected: same body, but with the peel
  // split open at the tip into a couple of drooping flaps so it reads as
  // "half peeled" as it tumbles away.
  bananaPeeled(ctx, x, y, r){
    ART.wobble(ctx, c=>{
      // body (slightly paler fruit showing through)
      c.beginPath();
      c.moveTo(x - r*0.9, y - r*0.2);
      c.quadraticCurveTo(x - r*0.2, y + r*1.1, x + r*0.95, y - r*0.1);
      c.quadraticCurveTo(x + r*0.2, y + r*0.45, x - r*0.9, y - r*0.2);
      c.closePath();
      c.fillStyle = '#fff3c4'; c.fill();   // pale, peeled fruit
      c.stroke();
      // peel flaps opening from the left tip, drooping down
      c.beginPath();
      c.moveTo(x - r*0.9, y - r*0.2);
      c.quadraticCurveTo(x - r*1.5, y + r*0.2, x - r*1.25, y + r*0.85);
      c.stroke();
      c.beginPath();
      c.moveTo(x - r*0.9, y - r*0.2);
      c.quadraticCurveTo(x - r*1.7, y - r*0.1, x - r*1.6, y + r*0.55);
      c.stroke();
    });
  },

  broccoli(ctx, x, y, r){
    ART.wobble(ctx, c=>{
      // stalk
      c.beginPath();
      c.moveTo(x - r*0.18, y + r*0.9);
      c.lineTo(x - r*0.1, y);
      c.moveTo(x + r*0.18, y + r*0.9);
      c.lineTo(x + r*0.1, y);
      c.stroke();
      // florets (3 bumpy circles)
      [[-0.5,-0.2,0.55],[0.5,-0.2,0.55],[0,-0.6,0.6]].forEach(([dx,dy,rr])=>{
        c.beginPath();
        c.arc(x+dx*r, y+dy*r, rr*r, 0, Math.PI*2);
        c.fillStyle = CONFIG.broccoliFill; c.fill();
        c.stroke();
      });
    });
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

  catchZone(ctx, x, y, r){
    ART.wobble(ctx, c=>{
      c.setLineDash([10,12]);
      c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.stroke();
    });
  }
};
