// Audio sintetizzato con WebAudio: effetti, ronzio della trivella e musica. Nessun file esterno.
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
// La minore · Fa · Do · Sol: nota di basso e tre note dell'accordo
const PROG = [[45, 57, 60, 64], [41, 57, 60, 65], [36, 55, 60, 64], [43, 55, 59, 62]];
const ARP = [0, 1, 2, 1, 0, 2, 1, 2];

export class Sound {
  constructor() {
    this.ctx = null; this.sfxVol = .8; this.musVol = .5; this.mode = 'menu';
    this.pelStep = 0; this.pelLast = 0; this.stepIdx = 0; this.nextT = 0;
  }

  // Da chiamare a ogni comando: il browser permette l'audio solo dopo un gesto dell'utente.
  unlock() {
    if (!this.ctx) this.init();
    else if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor(); comp.connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.connect(comp);
    this.musBus = c.createGain(); this.musBus.connect(comp);
    this.echo = c.createDelay(1); this.echo.delayTime.value = .285;
    const fb = c.createGain(); fb.gain.value = .32;
    this.echo.connect(fb); fb.connect(this.echo); this.echo.connect(this.musBus);
    this.applyVolumes();

    const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // ronzio continuo della trivella, a volume zero finché la sonda è ferma
    this.drill = c.createOscillator(); this.drill.type = 'sawtooth'; this.drill.frequency.value = 58;
    this.drillLp = c.createBiquadFilter(); this.drillLp.type = 'lowpass'; this.drillLp.frequency.value = 420;
    this.drillGain = c.createGain(); this.drillGain.gain.value = 0;
    this.drill.connect(this.drillLp); this.drillLp.connect(this.drillGain); this.drillGain.connect(this.sfxBus);
    this.drill.start();

    this.nextT = c.currentTime + .1;
    setInterval(() => this.schedule(), 40);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxBus.gain.value = this.sfxVol;
    this.musBus.gain.value = this.musVol * .5;
  }
  setVolumes(sfx, music) { this.sfxVol = sfx; this.musVol = music; this.applyVolumes(); }

  tone(freq, dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = o.when || c.currentTime, osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(o.vol || .2, t0 + (o.attack || .005));
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus || this.sfxBus);
    if (o.echo) g.connect(this.echo);
    osc.start(t0); osc.stop(t0 + dur + .03);
  }
  noise(dur, o = {}) {
    const c = this.ctx; if (!c) return;
    const t0 = o.when || c.currentTime, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noiseBuf; src.loop = true;
    f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(o.vol || .2, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || this.sfxBus);
    src.start(t0); src.stop(t0 + dur + .03);
  }
  seq(notes, step, o = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    notes.forEach((n, i) => this.tone(hz(n), o.dur || step * 1.8, { type: o.type || 'triangle', vol: o.vol || .16, when: t + i * step }));
  }

  sfx(name) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    switch (name) {
      case 'pellet': {          // la nota sale finché si raccoglie di fila
        const now = c.currentTime;
        this.pelStep = now - this.pelLast < .45 ? Math.min(this.pelStep + 1, 14) : 0; this.pelLast = now;
        this.tone(hz(76 + [0, 2, 4, 7, 9][this.pelStep % 5] + 12 * Math.floor(this.pelStep / 5)), .07, { type: 'square', vol: .045 });
        break;
      }
      case 'crystal': this.seq([76, 83, 88, 95], .055, { vol: .14 }); break;
      case 'eat': this.tone(540, .2, { type: 'square', vol: .13, to: 110 }); this.noise(.16, { vol: .14, freq: 2400, to: 500 }); break;
      case 'zap': this.tone(1400, .16, { type: 'sawtooth', vol: .09, to: 300 }); this.noise(.1, { vol: .1, freq: 5000, type: 'highpass' }); break;
      case 'hit': this.noise(.7, { vol: .5, freq: 900, to: 70 }); this.tone(190, .6, { type: 'sawtooth', vol: .22, to: 36 }); break;
      case 'power': this.seq([72, 76, 79, 84, 88], .05, { vol: .14, type: 'square' }); break;
      case 'life': this.seq([84, 91, 96], .09, { vol: .16 }); break;
      case 'clear': this.seq([72, 76, 79, 84, 79, 84, 88], .1, { vol: .17, dur: .3 }); break;
      case 'over': this.seq([69, 65, 62, 57, 53], .2, { vol: .18, dur: .5, type: 'sawtooth' }); break;
      case 'ready': this.seq([72, 72, 79], .16, { vol: .1, dur: .12 }); break;
      case 'blocked': this.tone(170, .09, { type: 'square', vol: .06, to: 110 }); break;
      case 'warn': this.tone(210, .09, { type: 'triangle', vol: .05 }); break;
      case 'move': this.tone(620, .04, { type: 'square', vol: .05 }); break;
      case 'select': this.tone(520, .12, { type: 'square', vol: .08, to: 1040 }); break;
      case 'back': this.tone(520, .1, { type: 'square', vol: .06, to: 300 }); break;
    }
  }

  // 1 = avanza, -1 = si ritira, 0 = ferma
  setMotion(m) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    this.drillGain.gain.setTargetAtTime(m === 0 ? 0 : m > 0 ? .05 : .06, t, .04);
    this.drill.frequency.setTargetAtTime(m < 0 ? 132 : 58, t, .05);
    this.drillLp.frequency.setTargetAtTime(m < 0 ? 1100 : 420, t, .05);
  }

  // ------------------------------------------------------------ musica
  setMode(mode) { this.mode = mode; }
  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    if (this.nextT < c.currentTime - .2) this.nextT = c.currentTime + .05;     // scheda rimasta in pausa
    const sixteenth = 60 / 108 / 4;
    while (this.nextT < c.currentTime + .15) { this.step(this.stepIdx++, this.nextT); this.nextT += sixteenth; }
  }
  step(i, t) {
    const s = i % 16, chord = PROG[Math.floor(i / 16) % 4], game = this.mode === 'game', bus = this.musBus;
    if (s % 2 === 0 && (game || s % 8 === 0))
      this.tone(hz(chord[0] + (s % 8 === 6 ? 12 : 0)), game ? .2 : .9, { type: 'sawtooth', vol: game ? .1 : .06, when: t, bus, attack: .01 });
    if (s % 4 !== 3) {
      const n = chord[1 + ARP[s % 8]] + (s % 8 >= 4 ? 12 : 0) + (game ? 0 : -12);
      if (game || s % 2 === 0) this.tone(hz(n), .22, { type: 'triangle', vol: .07, when: t, bus, echo: true });
    }
    if (game) {
      if (s % 4 === 0) this.tone(120, .16, { type: 'sine', vol: .28, to: 38, when: t, bus });
      if (s % 4 === 2) this.noise(.04, { vol: .05, freq: 7000, type: 'highpass', when: t, bus });
    }
    if (s === 0) for (const n of chord.slice(1)) this.tone(hz(n), 2.1, { type: 'sine', vol: .025, when: t, bus, attack: .4 });
  }
}
