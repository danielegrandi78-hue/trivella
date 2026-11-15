// Comandi unificati da tastiera, gamepad e schermo a tocco.
//  - dirs() / retract(): stato continuo, per guidare la sonda
//  - edge: pressioni singole del fotogramma, per i menu
//  - takeTaps(): tocchi brevi sullo schermo, in coordinate di gioco
// A tocco: il dito nella metà sinistra è una levetta che nasce dove si appoggia,
// un dito nella metà destra ritira il tubo finché resta appoggiato.
import { PAUSE_BTN } from './config.js';

const DIRS = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0]
};
const MENU = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', KeyP: 'pause', F11: 'fullscreen'
};
const CAPTURED = new Set([...Object.keys(DIRS), 'Space', 'F11', 'Backspace']);

export class Input {
  constructor() {
    this.held = new Set(); this.order = []; this.queue = [];
    this.edge = {}; this.padPrev = []; this.padDir = null; this.padRetract = false;
    this.repDir = null; this.repT = 0; this.rumbleOn = true;
    addEventListener('keydown', e => {
      if (CAPTURED.has(e.code)) e.preventDefault();
      this.queue.push(e.code);                 // comprese le ripetizioni: servono ai cursori dei menu
      if (e.repeat) return;
      this.held.add(e.code);
      if (DIRS[e.code]) { this.order = this.order.filter(k => k !== e.code); this.order.push(e.code); }
    });
    addEventListener('keyup', e => { this.held.delete(e.code); this.order = this.order.filter(k => k !== e.code); });
    addEventListener('blur', () => { this.held.clear(); this.order = []; this.stick = null; this.retractIds.clear(); });

    // ---- schermo a tocco
    this.touch = false;                 // diventa vero al primo tocco
    this.stick = null;                  // levetta: { id, ox, oy, x, y } in pixel dello schermo
    this.retractIds = new Set(); this.downs = new Map(); this.taps = [];
    this.toLogical = (x, y) => ({ x, y });      // impostata da main: pixel dello schermo -> coordinate di gioco
    const active = { passive: false };
    addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault(); this.touch = true;
      const p = this.toLogical(e.clientX, e.clientY);
      const onPause = Math.hypot(p.x - PAUSE_BTN.x, p.y - PAUSE_BTN.y) < PAUSE_BTN.r + 14;
      this.downs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      if (onPause) return;
      if (e.clientX < innerWidth / 2) { if (!this.stick) this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; }
      else this.retractIds.add(e.pointerId);
    }, active);
    addEventListener('pointermove', e => {
      const s = this.stick;
      if (!s || s.id !== e.pointerId) return;
      e.preventDefault(); s.x = e.clientX; s.y = e.clientY;
      // il centro segue il dito quando esce dal raggio: invertire la direzione resta immediato
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy), R = this.stickRadius();
      if (d > R) { s.ox += dx * (d - R) / d; s.oy += dy * (d - R) / d; }
    }, active);
    const up = e => {
      const d = this.downs.get(e.pointerId);
      if (d) {
        this.downs.delete(e.pointerId);
        if (e.type === 'pointerup' && performance.now() - d.t < 600 && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 16)
          this.taps.push(this.toLogical(e.clientX, e.clientY));
      }
      if (this.stick && this.stick.id === e.pointerId) this.stick = null;
      this.retractIds.delete(e.pointerId);
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    // niente scorrimento, zoom o menu contestuale del browser durante il gioco
    for (const ev of ['touchmove', 'gesturestart', 'contextmenu']) document.addEventListener(ev, e => e.preventDefault(), active);
  }

  stickRadius() { return Math.max(34, Math.min(innerWidth, innerHeight) * .09); }
  takeTaps() { const t = this.taps; this.taps = []; return t; }

  pad() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of gps) if (p && p.connected && p.buttons.length >= 4) return p;
    return null;
  }

  poll(dt) {
    const e = this.edge = { up: false, down: false, left: false, right: false, confirm: false, back: false, pause: false, fullscreen: false, any: false, del: false, digits: [] };
    for (const code of this.queue) {
      e.any = true;
      const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
      if (digit) e.digits.push(digit[1]);               // per scrivere il codice di una partita
      else if (code === 'Escape') { e.back = true; e.pause = true; }
      else if (code === 'Backspace') e.del = true;
      else if (MENU[code]) e[MENU[code]] = true;
    }
    this.queue.length = 0;
    if (this.taps.length) e.any = true;

    const p = this.pad();
    let pd = null; this.padRetract = false;
    if (p) {
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const hit = i => b(i) && !this.padPrev[i];
      if (hit(0)) e.confirm = e.any = true;
      if (hit(1)) e.back = e.any = true;
      if (hit(9)) e.pause = e.any = true;
      this.padRetract = b(0) || b(2) || b(5) || b(7);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(12)) pd = 'up'; else if (b(13)) pd = 'down'; else if (b(14)) pd = 'left'; else if (b(15)) pd = 'right';
      else if (Math.max(Math.abs(ax), Math.abs(ay)) > .5) pd = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
      for (let i = 0; i < p.buttons.length; i++) this.padPrev[i] = b(i);
      // nei menu: prima pressione subito, poi ripetizione tenendo premuto
      if (pd !== this.repDir) { this.repDir = pd; this.repT = .4; if (pd) e[pd] = e.any = true; }
      else if (pd) { this.repT -= dt; if (this.repT <= 0) { this.repT = .13; e[pd] = true; } }
    } else { this.padPrev.length = 0; this.repDir = null; }
    this.padDir = pd;
  }

  // Tutte le direzioni tenute premute, la più recente per prima. Con due tasti insieme, o con la
  // levetta in diagonale, ne restituisce due: sarà il gioco a dare la precedenza alla svolta.
  dirs() {
    const out = [], add = (x, y) => { if (!out.some(d => d.x === x && d.y === y)) out.push({ x, y }); };
    for (let i = this.order.length - 1; i >= 0; i--) { const d = DIRS[this.order[i]]; add(d[0], d[1]); }
    const p = this.pad();
    if (p) {
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      if (b(12)) add(0, -1); if (b(13)) add(0, 1); if (b(14)) add(-1, 0); if (b(15)) add(1, 0);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, mx = Math.abs(ax), my = Math.abs(ay);
      if (Math.max(mx, my) > .5) {
        const hx = () => add(Math.sign(ax), 0), hy = () => add(0, Math.sign(ay));
        if (mx > my) { hx(); if (my > .35) hy(); } else { hy(); if (mx > .35) hx(); }
      }
    }
    const s = this.stick;
    if (s) {                                   // levetta a tocco: asse principale, più l'altro se il dito è in diagonale
      const dx = s.x - s.ox, dy = s.y - s.oy, mx = Math.abs(dx), my = Math.abs(dy), dead = this.stickRadius() * .32;
      if (Math.max(mx, my) > dead) {
        const hx = () => add(Math.sign(dx), 0), hy = () => add(0, Math.sign(dy));
        if (mx > my) { hx(); if (my > dead && my > mx * .5) hy(); } else { hy(); if (mx > dead && mx > my * .5) hx(); }
      }
    }
    return out;
  }
  retract() { return this.held.has('Space') || this.padRetract || this.retractIds.size > 0; }

  rumble(strength, ms) {
    if (!this.rumbleOn) return;
    const p = this.pad();
    try {
      if (p && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength });
      else if (this.touch && navigator.vibrate) navigator.vibrate(Math.round(Math.min(ms, 160) * strength));   // telefoni Android (iOS non lo supporta)
    } catch (err) { /* nessuna vibrazione disponibile */ }
  }
}
