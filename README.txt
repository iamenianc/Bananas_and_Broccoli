BANANAS & BROCCOLI — how to run on your PC
==========================================

The game is a PWA, so it needs to be served over a local web server
(opening index.html directly with file:// will run the GAME, but the
PWA install/offline features won't work, and some browsers block them).

FILES
  index.html        page markup only
  css/styles.css    all layout & visual styling
  js/config.js      tunable gameplay numbers (rebalance here)
  js/art.js         drawing functions (restyle here)
  js/engine.js      spawning, physics, input, scoring, loop
  assets/*.png      food & baby illustrations drawn by js/art.js
  assets/baby_*.png cartoon baby poses (neutral/catch/swat/eat/yuck)
  manifest.json     PWA manifest (icon, name, landscape lock)
  sw.js             service worker (offline/install support)
  README.txt        this file

QUICKEST WAY (Python — already on most Windows machines)
  1. Unzip this folder somewhere, e.g. C:\bananas
  2. Open a terminal (Win+R -> cmd -> Enter) and run:
         cd C:\bananas
         python -m http.server 8000
     (if "python" isn't found, try:  py -m http.server 8000 )
  3. Open your browser to:  http://localhost:8000
  4. Turn the window landscape (wider than tall) and click START.

ALTERNATIVE (Node.js)
         npx serve .
     then open the URL it prints (usually http://localhost:3000).

NOTES
  - Landscape only: in a portrait window it shows a "turn sideways" prompt.
    On desktop just make the browser window wider than it is tall.
  - Hold mouse/finger = SWAT, release = CATCH.
  - Move the baby UP/DOWN to dodge broccoli and reach stray bananas:
    drag the LEFT side of the screen (touch), move the mouse, or use the
    Up/Down arrow keys (W/S). Space also swats.
  - To install as an app: in Chrome/Edge, open the localhost URL, then
    use the install icon in the address bar.
