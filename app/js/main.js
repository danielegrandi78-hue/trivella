// Avvio, ciclo principale e passaggio tra le schermate.
import { Game } from './sim.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import * as ui from './ui.js';
import { W, H, PAUSE_BTN } from './config.js';

const KEY = 'trivella.v1';
const host = window.trivellaHost || null;          // presente solo nell'eseguibile (Electron)

// ---------------------------------------------------------------- impostazioni e classifica
const store = Object.assign({ sfx: .8, music: .5, rumble: true, fullscreen: true, scores: [] }, readStore());
function readStore() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (err) { return {}; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (err) { /* archivio non disponibile */ } }
const hiScore = () => store.scores.length ? store.scores[0].score : 0;

const R = new Renderer(document.getElementById('c'));
const input = new Input();
const snd = new Sound();
let game = null;                                   // onEvent viene chiamato già durante la creazione
game = new Game(onEvent);

let screen = 'title', sel = 0, backTo = 'title', overT = 0, result = null, clock = 0;

// pixel dello schermo -> coordinate di gioco (il canvas è scalato e centrato)
input.toLogical = (x, y) => { const r = R.cv.getBoundingClientRect(); return { x: (x - r.left) / (r.width || 1) * W, y: (y - r.top) / (r.height || 1) * H }; };
// Su iPhone e iPad l'audio parte solo se viene sbloccato dentro il gesto dell'utente.
for (const ev of ['pointerup', 'touchend', 'keydown', 'click']) addEventListener(ev, () => snd.unlock(), { passive: true });
const canFullscreen = !!host || !!document.fullscreenEnabled;     // su iPhone il browser non lo permette

function applySettings() {
  snd.setVolumes(store.sfx, store.music);
  input.rumbleOn = store.rumble;
}
// Schermo intero nel browser; su telefoni e tablet blocca anche l'orientamento in orizzontale.
function enterFullscreen() {
  const el = document.documentElement;
  if (!el.requestFullscreen || document.fullscreenElement) return;
  let p; try { p = el.requestFullscreen({ navigationUI: 'hide' }); } catch (err) { return; }
  if (p && p.then) p.then(() => { const o = window.screen && window.screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => { }); }).catch(() => { });
}
function applyFullscreen() {
  if (host) host.setFullscreen(store.fullscreen);
  else if (store.fullscreen) enterFullscreen();
  else if (document.fullscreenElement) document.exitFullscreen();
}
// Android nel browser: finché l'opzione è attiva, un tocco nei menu porta il gioco a schermo intero.
// (Installato sulla schermata Home parte già così; su iPhone il browser non lo consente.)
const isAndroid = /Android/i.test(navigator.userAgent);
const installed = (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) || navigator.standalone === true;
applySettings();
if (host) applyFullscreen();

// ---------------------------------------------------------------- eventi di gioco -> suoni e vibrazione
function onEvent(name) {
  if (!game || game.attract) return;
  snd.sfx(name);
  if (name === 'hit') input.rumble(.9, 350);
  else if (name === 'eat' || name === 'zap') input.rumble(.35, 90);
  else if (name === 'crystal' || name === 'power') input.rumble(.2, 70);
  else if (name === 'over') input.rumble(.6, 500);
}

// ---------------------------------------------------------------- schermate
function go(next) { screen = next; sel = 0; }
function startGame() { game.newGame(false); overT = 0; go('play'); }
function toTitle() { game.newGame(true); go('title'); }
function openOptions() { backTo = screen; go('options'); }
function closeOptions() { save(); const b = backTo; go(b); if (b === 'pause') sel = 2; else sel = 1; }

const step01 = (v, d) => Math.round(Math.max(0, Math.min(1, v + d * .1)) * 10) / 10;
function menuItems() {
  if (screen === 'title') return [
    { label: 'GIOCA', act: startGame },
    { label: 'OPZIONI', act: openOptions },
    ...(host ? [{ label: 'ESCI', act: () => host.quit() }] : [])
  ];
  if (screen === 'pause') return [
    { label: 'RIPRENDI', act: () => go('play') },
    { label: 'RICOMINCIA', act: startGame },
    { label: 'OPZIONI', act: openOptions },
    { label: 'MENU PRINCIPALE', act: toTitle }
  ];
  if (screen === 'options') return [
    { label: 'VOLUME EFFETTI', bar: store.sfx, set: v => { store.sfx = v; applySettings(); snd.sfx('eat'); } },
    { label: 'VOLUME MUSICA', bar: store.music, set: v => { store.music = v; applySettings(); } },
    { label: 'VIBRAZIONE', value: store.rumble ? 'SÌ' : 'NO', adj: () => { store.rumble = !store.rumble; applySettings(); input.rumble(.6, 200); } },
    ...(canFullscreen ? [{ label: 'SCHERMO INTERO', value: store.fullscreen ? 'SÌ' : 'NO', adj: () => { store.fullscreen = !store.fullscreen; applyFullscreen(); } }] : []),
    { label: 'INDIETRO', act: closeOptions }
  ].map(it => it.set ? Object.assign(it, { adj: d => it.set(step01(it.bar, d)) }) : it);
  return [];
}
// Tocco sullo schermo: sceglie la voce di menu toccata, o il pulsante di pausa durante la partita.
function handleTap(t) {
  if (isAndroid && !host && !installed && store.fullscreen && screen !== 'play') enterFullscreen();
  if (screen === 'gameover') { snd.sfx('select'); toTitle(); return; }
  if (screen === 'play') {
    if (game.phase !== 'over' && Math.hypot(t.x - PAUSE_BTN.x, t.y - PAUSE_BTN.y) < PAUSE_BTN.r + 14) { snd.sfx('back'); go('pause'); }
    return;
  }
  const items = menuItems(), i = ui.menuHit(screen, items.length, t.x, t.y);
  if (i < 0) return;
  const it = items[i]; sel = i; snd.sfx('select');
  if (it.set) { if (t.x >= W / 2 + 50) it.set(Math.max(0, Math.min(1, (Math.floor((t.x - (W / 2 + 60)) / 21) + 1) / 10))); }   // barra: il valore è il punto toccato
  else if (it.adj) it.adj(1);
  else if (it.act) it.act();
}
function runMenu(items) {
  const e = input.edge, n = items.length;
  if (e.up) { sel = (sel + n - 1) % n; snd.sfx('move'); }
  if (e.down) { sel = (sel + 1) % n; snd.sfx('move'); }
  const it = items[sel];
  if (!it) return;
  if (it.adj && (e.left || e.right)) it.adj(e.right ? 1 : -1);
  if (e.confirm) { snd.sfx('select'); if (it.act) it.act(); else if (it.adj) it.adj(1); }
}
function finishGame() {
  const entry = { score: game.score, level: game.level, date: new Date().toLocaleDateString('it-IT') };
  store.scores.push(entry); store.scores.sort((a, b) => b.score - a.score); store.scores = store.scores.slice(0, 5);
  const rank = store.scores.indexOf(entry);
  result = { score: game.score, level: game.level, rank, record: rank === 0 && game.score > 0 };
  save(); go('gameover');
}

// ---------------------------------------------------------------- ciclo
function update(dt) {
  clock += dt;
  input.poll(dt);
  const e = input.edge;
  if (e.any) snd.unlock();
  if (e.fullscreen) { store.fullscreen = !store.fullscreen; applyFullscreen(); save(); }
  for (const t of input.takeTaps()) handleTap(t);
  // dispositivo a tocco tenuto in verticale: la partita va in pausa (la pagina mostra "ruota il dispositivo")
  if (input.touch && innerHeight > innerWidth && screen === 'play' && game.phase !== 'over') go('pause');

  switch (screen) {
    case 'title':
      game.update(dt, null); runMenu(menuItems());
      break;
    case 'options':
      if (backTo === 'title') game.update(dt, null);
      if (e.back) { snd.sfx('back'); closeOptions(); } else runMenu(menuItems());
      break;
    case 'play':
      if (e.pause && game.phase !== 'over') { snd.sfx('back'); go('pause'); break; }
      game.update(dt, { dirs: input.dirs(), retract: input.retract() });
      if (game.phase === 'over') { overT += dt; if (overT > 1.8) finishGame(); }
      break;
    case 'pause':
      if (e.back || e.pause) { snd.sfx('select'); go('play'); } else runMenu(menuItems());
      break;
    case 'gameover':
      if (e.confirm || e.back) { snd.sfx('select'); toTitle(); }
      break;
  }
  snd.setMode(screen === 'play' ? 'game' : 'menu');
  snd.setMotion(screen === 'play' ? game.motion : 0);
}

function draw() {
  R.draw(game, { hud: !game.attract && screen !== 'gameover', hi: hiScore() });
  const g = R.ctx, touch = input.touch;
  if (screen === 'title') ui.title(g, clock, menuItems(), sel, hiScore(), touch);
  else if (screen === 'pause') ui.paused(g, clock, menuItems(), sel, touch);
  else if (screen === 'options') ui.options(g, clock, menuItems(), sel, backTo === 'title' ? .62 : .78, touch);
  else if (screen === 'gameover') ui.gameOver(g, clock, result, store.scores, touch);
  else if (screen === 'play' && touch && game.phase !== 'over') {
    let stick = null; const s = input.stick;
    if (s) {
      const o = input.toLogical(s.ox, s.oy), p = input.toLogical(s.x, s.y), k = W / (R.cv.getBoundingClientRect().width || W);
      stick = { ox: o.x, oy: o.y, x: p.x, y: p.y, r: input.stickRadius() * k };
    }
    ui.touchControls(g, stick, input.retractIds.size > 0);
  }
  g.textAlign = 'left'; g.letterSpacing = '0px';
}

const autoPause = () => { if (screen === 'play' && game.phase !== 'over') go('pause'); };
addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

// Versione web: tiene una copia dei file per poter giocare anche senza rete.
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- ganci di prova
// Permettono di far avanzare il gioco a comando, anche con la finestra nascosta.
const state = () => ({
  screen, sel, phase: game.phase, attract: game.attract, level: game.level, score: game.score, lives: game.lives,
  alive: game.L.alive, pipe: game.pipe.length, creatures: game.creatures.length, energy: +game.energy.toFixed(2), mult: game.mult()
});
window.__trivella = {
  game, state,
  // fa avanzare il gioco di s secondi con un comando fisso (solo durante la partita)
  step(s, inp) {
    for (let i = 0, n = Math.round(s * 60); i < n; i++) {
      if (screen === 'play') { game.update(1 / 60, inp || null); if (game.phase === 'over') { overT += 1 / 60; if (overT > 1.8) finishGame(); } }
      else if (screen === 'title') game.update(1 / 60, null);
    }
    draw(); return state();
  },
  // esegue n fotogrammi completi, comandi e menu compresi
  tick(n) { for (let i = 0; i < (n || 1); i++) update(1 / 60); draw(); return state(); },
  start() { startGame(); return state(); },
  // mostra un tipo di schermo preciso (0..6) per controllarne l'aspetto
  show(type, lv) { startGame(); game.startLevel(lv || 1, type); draw(); return { name: game.L.name, lanes: game.L.lanes, pellets: game.L.alive, rooms: game.L.rooms.length, entry: game.L.entry }; },
  selftest() { startGame(); return this.step(4, { dirs: [{ x: 0, y: 1 }], retract: false }); }
};
