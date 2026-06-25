/* ============================================================
   BANANAS & BROCCOLI — AUDIO SYSTEM
   ------------------------------------------------------------
   Loads and plays synthesized cartoon/vocal baby sound effects
   and BGM. Falls back to procedural chiptune synthesis using
   the browser's Web Audio API if asset files are missing or
   fail to load.
   ============================================================ */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = localStorage.getItem('bb_muted') === 'true';
    this.noiseBuffer = null;

    // BGM buffers
    this.bgmNormalBuffer = null;
    this.bgmPowerupBuffer = null;

    // Active BGM sources
    this.activeBgmSource = null;
    this.activeBgmType = null; // 'normal' | 'powerup' | null

    this.loadingBgm = false;

    // SFX buffers
    this.sfxBuffers = {};

    // Default gains for developer use
    const defaults = {
      bgm: 1.6,
      flap: 1.0,
      catch: 0.8,
      swat: 1.0,
      penalty: 1.0,
      eat_broccoli: 1.0,
      charge_start: 1.0,
      disco_activation: 1.0,
      warning: 1.0,
      click: 1.0
    };

    this.gains = {};
    for (const key in defaults) {
      const saved = localStorage.getItem(`bb_gain_${key}`);
      this.gains[key] = saved !== null ? parseFloat(saved) : defaults[key];
    }
  }

  // Initialize and resume AudioContext on first user interaction
  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.4, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.createNoiseBuffer();
      this.loadBGMFiles();
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser.", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  setMute(mute) {
    this.isMuted = mute;
    localStorage.setItem('bb_muted', mute ? 'true' : 'false');
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(mute ? 0 : 0.4, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMute(!this.isMuted);
    this.playButtonClick();
    return this.isMuted;
  }

  setGain(name, value) {
    if (this.gains[name] !== undefined) {
      this.gains[name] = value;
      localStorage.setItem(`bb_gain_${name}`, value);

      // If BGM gain is adjusted and music is currently playing, ramp to the new gain dynamically
      if (name === 'bgm' && this.activeBgmSource && this.activeBgmSource.gainNode) {
        if (this.ctx) {
          this.activeBgmSource.gainNode.gain.linearRampToValueAtTime(value, this.ctx.currentTime + 0.2);
        }
      }
      console.log(`Audio gain for '${name}' set to ${value}`);
    } else {
      console.warn(`Gain control for '${name}' does not exist.`);
    }
  }

  getGains() {
    return { ...this.gains };
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const size = this.ctx.sampleRate * 1.0; // 1 second of noise
    this.noiseBuffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  async loadBGMFiles() {
    if (this.loadingBgm) return;
    this.loadingBgm = true;

    const canPlayOgg = new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
    const ext = canPlayOgg ? '.ogg' : '.mp3';

    try {
      const sfxKeys = [
        'flap', 'catch', 'swat', 'penalty',
        'eat_broccoli', 'charge_start', 'disco_activation', 'warning', 'click'
      ];

      const promises = [
        this.safeFetchAndDecode(`assets/bgm_normal${ext}`),
        this.safeFetchAndDecode(`assets/bgm_powerup${ext}`)
      ];
      sfxKeys.forEach(key => {
        promises.push(this.safeFetchAndDecode(`assets/sfx_${key}${ext}`));
      });

      const results = await Promise.all(promises);

      this.bgmNormalBuffer = results[0];
      this.bgmPowerupBuffer = results[1];

      this.sfxBuffers = {};
      sfxKeys.forEach((key, idx) => {
        this.sfxBuffers[key] = results[2 + idx];
      });

      if (this.activeBgmType) {
        const type = this.activeBgmType;
        this.activeBgmType = null;
        this.startBGM(type);
      }
    } catch (e) {
      console.error("Failed to load or decode audio files:", e);
    } finally {
      this.loadingBgm = false;
    }
  }

  async fetchAndDecode(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return new Promise((resolve, reject) => {
      this.ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }

  async safeFetchAndDecode(url) {
    try {
      return await this.fetchAndDecode(url);
    } catch (e) {
      console.warn(`Failed to load or decode sound: ${url}, falling back to procedural synthesis.`, e);
      return null;
    }
  }

  playSfxBuffer(key) {
    if (!this.ctx || this.isMuted || !this.sfxBuffers || !this.sfxBuffers[key]) {
      return false;
    }
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.sfxBuffers[key];

      const gainNode = this.ctx.createGain();
      const gainValue = this.gains[key] !== undefined ? this.gains[key] : 1.0;
      gainNode.gain.setValueAtTime(gainValue, this.ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(this.masterGain);
      source.start(0);
      return true;
    } catch (e) {
      console.warn(`Error playing buffer for SFX '${key}':`, e);
      return false;
    }
  }

  startBGM(type) {
    this.init();
    this.resume();

    if (this.activeBgmType === type) return;

    this.stopBGM();
    this.activeBgmType = type;

    const buffer = type === 'normal' ? this.bgmNormalBuffer : this.bgmPowerupBuffer;
    if (!buffer) {
      return;
    }

    if (!this.ctx) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.gains.bgm, this.ctx.currentTime + 1.0);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(0);

    this.activeBgmSource = { source, gainNode };
  }

  stopBGM() {
    if (this.activeBgmSource) {
      const { source, gainNode } = this.activeBgmSource;
      try {
        const fadeTime = 0.3;
        gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeTime);
        source.stop(this.ctx.currentTime + fadeTime);
      } catch (e) {
        // ignore
      }
      this.activeBgmSource = null;
    }
    this.activeBgmType = null;
  }

  // 1. Flap (Jump) - Upward pitch sweep
  playFlap() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('flap')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(480, t + 0.15);

    const gainScale = this.gains.flap;
    gain.gain.setValueAtTime(0.7 * gainScale, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * gainScale, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  // 2. Catch Banana - Small drop of water dropping into a bucket
  playCatchBanana() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('catch')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;

    // Droplet (upward chirp: 600 Hz to 1800 Hz)
    const oscDrop = this.ctx.createOscillator();
    const gainDrop = this.ctx.createGain();

    oscDrop.type = 'sine';
    oscDrop.frequency.setValueAtTime(600, t);
    oscDrop.frequency.exponentialRampToValueAtTime(1800, t + 0.12);

    const gainScale = this.gains.catch;
    gainDrop.gain.setValueAtTime(0, t);
    gainDrop.gain.linearRampToValueAtTime(0.6 * gainScale, t + 0.002);
    gainDrop.gain.exponentialRampToValueAtTime(0.001 * gainScale, t + 0.12);

    oscDrop.connect(gainDrop);
    gainDrop.connect(this.masterGain);

    oscDrop.start(t);
    oscDrop.stop(t + 0.13);

    // Bucket Cav Resonance (800 Hz tone, starts 5ms in, decays slower)
    const oscRes = this.ctx.createOscillator();
    const gainRes = this.ctx.createGain();

    oscRes.type = 'sine';
    oscRes.frequency.setValueAtTime(800, t);

    gainRes.gain.setValueAtTime(0, t);
    gainRes.gain.setValueAtTime(0, t + 0.005);
    gainRes.gain.linearRampToValueAtTime(0.15 * gainScale, t + 0.008);
    gainRes.gain.exponentialRampToValueAtTime(0.001 * gainScale, t + 0.2);

    oscRes.connect(gainRes);
    gainRes.connect(this.masterGain);

    oscRes.start(t);
    oscRes.stop(t + 0.22);
  }

  // 3. Swat Broccoli - White noise whack + low sweep
  playSwatBroccoli() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('swat')) return;
    if (!this.ctx || this.isMuted || !this.noiseBuffer) return;

    const t = this.ctx.currentTime;

    const gainScale = this.gains.swat;

    // Noise Node for the whack/impact
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1000, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, t + 0.1);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6 * gainScale, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01 * gainScale, t + 0.1);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Tonal body for the hit (low pitch drop)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.linearRampToValueAtTime(90, t + 0.12);

    oscGain.gain.setValueAtTime(0.5 * gainScale, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01 * gainScale, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    noise.start(t);
    noise.stop(t + 0.11);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  // 4. Swat Broccoli (Precise Tap Bonus) - Redirected to standard swat
  playSwatBonus() {
    this.playSwatBroccoli();
  }

  // 5. Swat/Drop Banana (Penalty) - Descending squish/slide
  playSwatBanana() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('penalty')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.linearRampToValueAtTime(60, t + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.22);

    const gainScale = this.gains.penalty;
    gain.gain.setValueAtTime(0.5 * gainScale, t);
    gain.gain.linearRampToValueAtTime(0.01 * gainScale, t + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.23);
  }

  // 6. Eat Broccoli (Damage) - Sour, low-pitched disgusted grumble
  playEatBroccoli() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('eat_broccoli')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90, t);
    // Add frequency wobble (gargling/yuck sound)
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.linearRampToValueAtTime(80, t + 0.1);
    osc.frequency.linearRampToValueAtTime(95, t + 0.2);
    osc.frequency.linearRampToValueAtTime(75, t + 0.3);
    osc.frequency.linearRampToValueAtTime(60, t + 0.4);

    const gainScale = this.gains.eat_broccoli;
    gain.gain.setValueAtTime(0.6 * gainScale, t);
    gain.gain.linearRampToValueAtTime(0.6 * gainScale, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001 * gainScale, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.46);
  }

  // 7. Disco Ball Catch (Power-Up Charge Started) - Chime riser
  playChargeStart() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('charge_start')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    const gainScale = this.gains.charge_start;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);
      gain.gain.setValueAtTime(0, t + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.3 * gainScale, t + idx * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001 * gainScale, t + idx * 0.05 + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.2);
    });
  }

  // 8. Disco Power-Up Fully Charged / Activation - Victorious fanfare
  playDiscoActivation() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('disco_activation')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    // Triumphant chiptune phrase: C5 -> E5 -> G5 -> C6 -> E6
    const melody = [
      { f: 523.25, d: 0.06 },  // C5
      { f: 659.25, d: 0.06 },  // E5
      { f: 783.99, d: 0.06 },  // G5
      { f: 1046.50, d: 0.08 }, // C6
      { f: 1318.51, d: 0.3 }   // E6
    ];

    const gainScale = this.gains.disco_activation;
    let currentOffset = 0;
    melody.forEach((note) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(note.f, t + currentOffset);

      // Add a retro vibrato to the final long note
      if (note.d > 0.1) {
        const vibrato = this.ctx.createOscillator();
        const vibratoGain = this.ctx.createGain();
        vibrato.frequency.setValueAtTime(12, t + currentOffset); // 12Hz wobble
        vibratoGain.gain.setValueAtTime(10, t + currentOffset); // +/- 10Hz swing
        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);
        vibrato.start(t + currentOffset);
        vibrato.stop(t + currentOffset + note.d);
      }

      gain.gain.setValueAtTime(0, t + currentOffset);
      gain.gain.linearRampToValueAtTime(0.25 * gainScale, t + currentOffset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001 * gainScale, t + currentOffset + note.d);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + currentOffset);
      osc.stop(t + currentOffset + note.d + 0.02);

      currentOffset += note.d * 0.8;
    });
  }

  // 9. BGM Compatibility Hooks
  startDiscoLoop() {
    this.startBGM('powerup');
  }

  stopDiscoLoop() {
    if (this.activeBgmType === 'powerup') {
      this.startBGM('normal');
    } else {
      this.stopBGM();
    }
  }

  // 10. Broccoli Barrage Warning - Alternating sirens
  playBarrageWarning() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('warning')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const gainScale = this.gains.warning;

    // Play 3 pulses of high/low alarm
    for (let i = 0; i < 3; i++) {
      const pulseTime = t + i * 0.3;

      // High pitch
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(750, pulseTime);
      gain1.gain.setValueAtTime(0, pulseTime);
      gain1.gain.linearRampToValueAtTime(0.3 * gainScale, pulseTime + 0.02);
      gain1.gain.linearRampToValueAtTime(0.3 * gainScale, pulseTime + 0.12);
      gain1.gain.exponentialRampToValueAtTime(0.001 * gainScale, pulseTime + 0.15);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(pulseTime);
      osc1.stop(pulseTime + 0.16);

      // Low pitch
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(580, pulseTime + 0.15);
      gain2.gain.setValueAtTime(0, pulseTime + 0.15);
      gain2.gain.linearRampToValueAtTime(0.3 * gainScale, pulseTime + 0.17);
      gain2.gain.linearRampToValueAtTime(0.3 * gainScale, pulseTime + 0.27);
      gain2.gain.exponentialRampToValueAtTime(0.001 * gainScale, pulseTime + 0.3);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(pulseTime + 0.15);
      osc2.stop(pulseTime + 0.31);
    }
  }

  // 11. Button Click - Comical micro UI pop
  playButtonClick() {
    this.init();
    this.resume();
    if (this.playSfxBuffer('click')) return;
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);

    const gainScale = this.gains.click;
    gain.gain.setValueAtTime(0.5 * gainScale, t);
    gain.gain.exponentialRampToValueAtTime(0.01 * gainScale, t + 0.045);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }
}

// Create a globally accessible instance
const AUDIO = new AudioManager();
