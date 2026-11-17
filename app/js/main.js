// Avvio, ciclo principale e passaggio tra le schermate.
import { Game } from './sim.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Net, onlineAvailable, probe } from './net.js';
import * as ui from './ui.js';
import { W, H, PAUSE_BTN } from './config.js';
import { TYPES } from './level.js';

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
function onEvent(name, data) {
  if (!game || game.attract) return;
  snd.sfx(name);
  if (name === 'eat' && inVersus()) net.send({ t: 'gift', k: data });     // dispetto: il mostro mangiato va all'avversario
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
function closeOptions() { save(); go(backTo); sel = Math.max(0, menuItems().findIndex(it => it.label === 'OPZIONI')); }

// ---------------------------------------------------------------- sfida online
// Ognuno gioca la propria mappa (stessa sequenza di settori) e manda all'altro una fotografia
// della partita 15 volte al secondo; "ghost" è la copia della partita dell'avversario.
const net = new Net();
let ghost = null, role = 0, joinCode = '';
let mp = { mode: 'quick', status: 'connecting', code: '', error: '' };
let vs = { sendT: 0, result: null, again: false, theirAgain: false, peerGone: false };
const inVersus = () => screen === 'versus' || screen === 'vsmenu';

function mpStart(mode, code) {
  mp = { mode, status: 'connecting', code: '', error: '' };
  go('mpwait');
  if (mode === 'quick') net.quick(); else if (mode === 'host') net.host(); else net.join(code);
}
net.onStatus = (st, info) => {
  if (st === 'waiting') { mp.status = 'waiting'; mp.code = info || ''; }
  else if (st === 'ready') { role = info; if (role === 0) hostInit(); }        // chi è arrivato per primo decide le mappe
  else if (st === 'bye' || st === 'offline') peerLeft(st);
  else if (st === 'error') {
    if (inVersus() || screen === 'vsend') peerLeft('offline');
    else if (screen === 'mpwait') { mp.status = 'error'; mp.error = info; }
  }
};
net.onMessage = m => {
  if (m.t === 'init' && role === 1 && Array.isArray(m.types)) beginVersus(m);
  else if (m.t === 's' && ghost && (inVersus() || screen === 'vsend')) { try { ghost.applySnap(m); } catch (err) { /* fotografia non valida: la ignoro */ } }
  else if (m.t === 'gift' && inVersus()) game.queueGift(m.k);
  else if (m.t === 'again') { vs.theirAgain = true; tryRematch(); }
};
function hostInit() {
  const types = [];
  for (let round = 0; round < 3; round++) {                 // tutti i tipi di schermo, in ordine casuale, per tre giri
    const q = TYPES.map((_, i) => i);
    for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[q[i], q[j]] = [q[j], q[i]]; }
    types.push(...q);
  }
  const init = { t: 'init', seed: (Math.random() * 1e9) | 0, types };
  net.send(init); beginVersus(init);
}
function beginVersus(init) {
  const opts = { seed: init.seed | 0, types: init.types.map(x => Math.abs(x | 0) % TYPES.length) };
  game.newGame(false, opts);
  if (!ghost) ghost = new Game(() => { });
  ghost.newGame(false, opts);
  vs = { sendT: 0, result: null, again: false, theirAgain: false, peerGone: false };
  go('versus');
}
function endVersus(kind, note) {
  net.send(game.snap());                                     // ultima fotografia: l'altro vede com'è finita
  vs.result = { kind, mine: game.score, theirs: ghost.score, note: note || '' };
  snd.sfx(kind === 'win' || kind === 'forfeit' ? 'clear' : 'over');
  go('vsend');
}
function peerLeft(why) {
  const note = why === 'offline' ? 'COLLEGAMENTO INTERROTTO' : 'L\'AVVERSARIO HA LASCIATO LA PARTITA';
  if (inVersus()) { vs.peerGone = true; endVersus(why === 'offline' ? 'offline' : 'forfeit', note); }
  else if (screen === 'vsend') vs.peerGone = true;
  else if (screen === 'mpwait') { mp.status = 'error'; mp.error = 'L\'avversario si è scollegato'; }
}
function tryRematch() { if (vs.again && vs.theirAgain && role === 0 && screen === 'vsend') hostInit(); }
function leaveVersus() { net.close(); toTitle(); }
function runVersus(dt, control) {
  game.update(dt, control ? { dirs: input.dirs(), retract: input.retract() } : null);
  ghost.puppetTick(dt);
  if ((vs.sendT -= dt) <= 0) { vs.sendT = 1 / 15; net.send(game.snap()); }
  const lost = game.phase === 'over', won = ghost.phase === 'over';
  if (lost && won) endVersus(game.score > ghost.score ? 'win' : game.score < ghost.score ? 'lose' : 'draw', 'SONDE FINITE PER ENTRAMBI: CONTANO I PUNTI');
  else if (lost) endVersus('lose', 'HAI FINITO LE SONDE');
  else if (won) endVersus('win', 'L\'AVVERSARIO HA FINITO LE SONDE');
}
function pressKey(k) {
  if (k === '<') joinCode = joinCode.slice(0, -1);
  else if (k === 'OK') { if (joinCode.length === 5) mpStart('join', joinCode); }
  else if (joinCode.length < 5) { joinCode += k; if (joinCode.length === 5) sel = ui.KEYS.indexOf('OK'); }
}

const step01 = (v, d) => Math.round(Math.max(0, Math.min(1, v + d * .1)) * 10) / 10;
function menuItems() {
  if (screen === 'title') return [
    { label: 'GIOCA', act: startGame },
    ...(onlineAvailable() ? [{ label: 'SFIDA ONLINE', act: () => go('multi') }] : []),
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
  if (screen === 'multi') return [
    { label: 'PARTITA VELOCE', act: () => mpStart('quick') },
    { label: 'CREA CON CODICE', act: () => mpStart('host') },
    { label: 'ENTRA CON CODICE', act: () => { joinCode = ''; go('mpjoin'); sel = 4; } },
    { label: 'INDIETRO', act: () => { go('title'); sel = 1; } }      // torna su "Sfida online"
  ];
  if (screen === 'vsmenu') return [
    { label: 'RIPRENDI', act: () => go('versus') },
    { label: 'ABBANDONA', act: leaveVersus }
  ];
  if (screen === 'vsend') return [
    ...(vs.peerGone ? [] : [{ label: vs.again ? 'IN ATTESA DELL\'AVVERSARIO' : 'RIVINCITA', act: () => { if (!vs.again) { vs.again = true; net.send({ t: 'again' }); tryRematch(); } } }]),
    { label: 'MENU PRINCIPALE', act: leaveVersus }
  ];
  return [];
}
// Tocco sullo schermo: sceglie la voce di menu toccata, o il pulsante di pausa durante la partita.
function handleTap(t) {
  if (isAndroid && !host && !installed && store.fullscreen && screen !== 'play') enterFullscreen();
  if (screen === 'gameover') { snd.sfx('select'); toTitle(); return; }
  if (screen === 'play' || screen === 'versus') {
    if (game.phase !== 'over' && Math.hypot(t.x - PAUSE_BTN.x, t.y - PAUSE_BTN.y) < PAUSE_BTN.r + 14) { snd.sfx('back'); go(screen === 'play' ? 'pause' : 'vsmenu'); }
    return;
  }
  if (screen === 'mpwait') { if (mp.status === 'error' || ui.cancelHit(t.x, t.y)) { snd.sfx('back'); net.close(); go('multi'); } return; }
  if (screen === 'mpjoin') {
    const k = ui.keypadHit(t.x, t.y);
    if (k >= 0) { sel = k; snd.sfx('move'); pressKey(ui.KEYS[k]); }
    else if (ui.cancelHit(t.x, t.y)) { snd.sfx('back'); go('multi'); sel = 2; }
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
    case 'multi':
      game.update(dt, null);
      if (e.back) { snd.sfx('back'); go('title'); sel = 1; } else runMenu(menuItems());
      break;
    case 'mpwait':
      game.update(dt, null);
      if (e.back || (mp.status === 'error' && e.confirm)) { snd.sfx('back'); net.close(); go('multi'); }
      break;
    case 'mpjoin': {
      game.update(dt, null);
      for (const d of e.digits) pressKey(d);
      if (e.del) pressKey('<');
      if (screen !== 'mpjoin') break;                        // il codice era completo ed è partito il collegamento
      if (e.back) { snd.sfx('back'); go('multi'); sel = 2; break; }
      const col = sel % 3, row = (sel / 3) | 0;
      if (e.left) sel = row * 3 + (col + 2) % 3;
      if (e.right) sel = row * 3 + (col + 1) % 3;
      if (e.up) sel = ((row + 3) % 4) * 3 + col;
      if (e.down) sel = ((row + 1) % 4) * 3 + col;
      if (e.left || e.right || e.up || e.down) snd.sfx('move');
      if (e.confirm) { snd.sfx('select'); pressKey(ui.KEYS[sel]); }
      break;
    }
    case 'versus':
      if (e.pause) { snd.sfx('back'); go('vsmenu'); }
      runVersus(dt, screen === 'versus');
      break;
    case 'vsmenu':                                           // la sfida continua anche con il menu aperto
      if (e.back || e.pause) { snd.sfx('select'); go('versus'); } else runMenu(menuItems());
      if (inVersus()) runVersus(dt, false);
      break;
    case 'vsend':
      ghost.puppetTick(dt);
      runMenu(menuItems());
      break;
  }
  const playing = screen === 'play' || inVersus();
  snd.setMode(playing ? 'game' : 'menu');
  snd.setMotion(playing ? game.motion : 0);
}

function draw() {
  const g = R.ctx, touch = input.touch, split = inVersus() || screen === 'vsend';
  if (split) {                                               // sfida: la mia mappa grande, l'avversario nel riquadro a destra
    R.clear();
    R.draw(game, { view: ui.VS_MAIN, slot: 0, hud: screen !== 'vsend', hi: hiScore() });
    R.draw(ghost, { view: ui.VS_PIP, slot: 1, pel: 5 });
    ui.versusSide(g, ghost);
  } else R.draw(game, { hud: !game.attract && screen !== 'gameover', hi: hiScore() });
  if (screen === 'multi') ui.multi(g, clock, menuItems(), sel, touch);
  else if (screen === 'mpwait') ui.mpWait(g, clock, mp, touch);
  else if (screen === 'mpjoin') ui.mpJoin(g, clock, joinCode, sel, touch);
  else if (screen === 'vsmenu') ui.versusMenu(g, clock, menuItems(), sel);
  else if (screen === 'vsend') ui.versusEnd(g, clock, vs.result, menuItems(), sel);
  if (screen === 'title') ui.title(g, clock, menuItems(), sel, hiScore(), touch);
  else if (screen === 'pause') ui.paused(g, clock, menuItems(), sel, touch);
  else if (screen === 'options') ui.options(g, clock, menuItems(), sel, backTo === 'title' ? .62 : .78, touch);
  else if (screen === 'gameover') ui.gameOver(g, clock, result, store.scores, touch);
  else if ((screen === 'play' || screen === 'versus') && touch && game.phase !== 'over') {
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
  screen, sel, mp: mp.status + (mp.code ? ':' + mp.code : '') + (mp.error ? ':' + mp.error : ''), role,
  vs: vs.result ? vs.result.kind : '', ghost: ghost ? { phase: ghost.phase, score: ghost.score, lives: ghost.lives, pipe: ghost.pipe.length, alive: ghost.L.alive, seed: ghost.seed } : null, seed: game.seed,
  phase: game.phase, attract: game.attract, level: game.level, score: game.score, lives: game.lives,
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
  online: probe,
  // mostra un tipo di schermo preciso (0..6) per controllarne l'aspetto
  show(type, lv, bonus) { startGame(); game.startLevel(lv || 1, type, bonus); draw(); return { name: game.L.name, lanes: game.L.lanes, pellets: game.L.alive, rooms: game.L.rooms.length, entry: game.L.entry }; },
  selftest() { startGame(); return this.step(4, { dirs: [{ x: 0, y: 1 }], retract: false }); }
};
