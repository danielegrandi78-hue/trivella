// Schermate sovrapposte al gioco: titolo, menu, opzioni, fine partita.
// Tutte disegnano in coordinate logiche 1280x720 (il contesto è già scalato).
import { W, H, FONT, PAUSE_BTN, MONSTERS_PER_LIFE } from './config.js';
import { txt } from './render.js';

const ORANGE = '#ffb868', DIM = 'rgba(200,205,255,.55)', WHITE = '#f2f4ff', CYAN = 'hsl(186,100%,74%)';

// Posizione delle voci dei menu: [y della prima voce, passo]. Serve anche per riconoscere i tocchi.
export const MENU_POS = { title: [392, 48], pause: [340, 48], options: [320, 52], multi: [330, 54], vsmenu: [350, 52], vsend: [520, 50] };

// Sfida online: la propria mappa grande a sinistra, con la sua barra di stato; l'avversario in un
// riquadro piccolo nella colonna di destra, con sotto i suoi dati. (Due mappe affiancate a metà
// grandezza erano troppo piccole per giocare.)
export const VS_MAIN = { x: 0, y: 72, s: .8 };             // 1024 x 576
export const VS_PIP = { x: 1034, y: 118, s: .1875 };       // 240 x 135
// Tastierino per il codice della partita: 3 colonne x 4 righe.
export const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '<', '0', 'OK'];
const KP = { x: W / 2 - 165, y: 330, w: 110, h: 68 };
export function keypadHit(x, y) {
  const c = Math.floor((x - KP.x) / KP.w), r = Math.floor((y - KP.y) / KP.h);
  return c >= 0 && c < 3 && r >= 0 && r < 4 ? r * 3 + c : -1;
}
// Tastiera a schermo per il nome del giocatore: 4 righe da 10 tasti.
export const NICK_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.split('').concat(['<', 'OK']);
export const NICK_MAX = 10;
const NK = { x: W / 2 - 330, y: 318, w: 66, h: 62 };
export function nickHit(x, y) {
  const c = Math.floor((x - NK.x) / NK.w), r = Math.floor((y - NK.y) / NK.h);
  return c >= 0 && c < 10 && r >= 0 && r < 4 ? r * 10 + c : -1;
}
// Pulsante "annulla / indietro" in basso, per gli schermi a tocco.
export const cancelHit = (x, y) => Math.abs(x - W / 2) < 170 && Math.abs(y - 655) < 30;
// Indice della voce toccata, oppure -1.
export function menuHit(screen, count, x, y) {
  const pos = MENU_POS[screen];
  if (!pos || Math.abs(x - W / 2) > 340) return -1;
  const i = Math.round((y - (pos[0] - 8)) / pos[1]);
  return i >= 0 && i < count ? i : -1;
}

export function veil(g, a) { g.fillStyle = `rgba(3,3,12,${a})`; g.fillRect(0, 0, W, H); }

export function logo(g, y, size) {
  g.save(); g.shadowColor = '#ff7a1e'; g.shadowBlur = 46;
  txt(g, 'TRIVELLA', W / 2 + size * .14, y, `700 ${size}px ${FONT}`, ORANGE, size * .28, 'center');
  g.restore();
}

export function heading(g, text, y) {
  g.save(); g.shadowColor = '#ff7a1e'; g.shadowBlur = 30;
  txt(g, text, W / 2 + 6, y, `700 54px ${FONT}`, ORANGE, 12, 'center');
  g.restore();
}

// items: { label, value?, bar? (0..1) }
export function menu(g, t, items, sel, y0, step) {
  step = step || 48;
  items.forEach((it, i) => {
    const y = y0 + i * step, on = i === sel, wide = it.value !== undefined || it.bar !== undefined;
    if (on) {
      const w = wide ? 620 : 360;
      const gr = g.createLinearGradient(W / 2 - w / 2, 0, W / 2 + w / 2, 0);
      gr.addColorStop(0, 'rgba(255,150,60,0)'); gr.addColorStop(.5, 'rgba(255,150,60,.2)'); gr.addColorStop(1, 'rgba(255,150,60,0)');
      g.fillStyle = gr; g.fillRect(W / 2 - w / 2, y - 27, w, 38);
    }
    const col = on ? ORANGE : 'rgba(226,230,255,.72)', font = `${on ? 700 : 600} 22px ${FONT}`;
    if (!wide) {
      txt(g, it.label, W / 2 + 3, y, font, col, 6, 'center');
      if (on) {
        const dx = 150 + 5 * Math.sin(t * 6);
        g.fillStyle = ORANGE;
        g.beginPath(); g.moveTo(W / 2 - dx, y - 15); g.lineTo(W / 2 - dx + 11, y - 8); g.lineTo(W / 2 - dx, y - 1); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(W / 2 + dx, y - 15); g.lineTo(W / 2 + dx - 11, y - 8); g.lineTo(W / 2 + dx, y - 1); g.closePath(); g.fill();
      }
    } else {
      txt(g, it.label, W / 2 - 280, y, font, col, 4);
      if (it.bar !== undefined) {
        const n = 10, lit = Math.round(it.bar * n);
        for (let k = 0; k < n; k++) { g.fillStyle = k < lit ? (on ? ORANGE : 'rgba(226,230,255,.72)') : 'rgba(200,205,255,.16)'; g.fillRect(W / 2 + 60 + k * 21, y - 17, 15, 18); }
      } else txt(g, it.value, W / 2 + 268, y, font, col, 4, 'right');
      if (on && !it.noArrows) txt(g, '◂  ▸', W / 2 + 20, y - 2, `600 16px ${FONT}`, ORANGE, 0, 'center');
    }
  });
}

export function controlsHint(g, y, touch) {
  const s = touch
    ? 'POLLICE SINISTRO  muovi        POLLICE DESTRO  ritrai il tubo        II  pausa'
    : 'FRECCE · WASD · LEVETTA  muovi        SPAZIO · A  ritrai il tubo        ESC · START  pausa';
  txt(g, s, W / 2, y, `500 13px ${FONT}`, DIM, 1.5, 'center');
}

export function title(g, t, items, sel, hi, touch) {
  veil(g, .42);
  logo(g, 250, 104);
  txt(g, 'SCAVA · RACCOGLI · NON FARTI TOCCARE IL TUBO', W / 2 + 3, 292, `600 15px ${FONT}`, CYAN, 6, 'center');
  menu(g, t, items, sel, MENU_POS.title[0], MENU_POS.title[1]);
  if (hi > 0) txt(g, 'RECORD  ' + String(hi).padStart(6, '0'), W / 2 + 2, 392 + items.length * 48 + 22, `600 15px ${FONT}`, DIM, 4, 'center');
  txt(g, 'Mangia i mostri con la bocca della trivella. Se un mostro tocca il tubo perdi una sonda. Quelli rossi non si mangiano.', W / 2, H - 72, `500 14px ${FONT}`, 'rgba(226,230,255,.7)', .5, 'center');
  txt(g, `Ogni ${MONSTERS_PER_LIFE} mostri mangiati guadagni una sonda. I pallini grossi rallentano i mostri. Il tubo si ritira solo con ` + (touch ? 'il pollice destro.' : 'SPAZIO (A sul gamepad).'), W / 2, H - 50, `500 14px ${FONT}`, 'rgba(226,230,255,.7)', .5, 'center');
  controlsHint(g, H - 24, touch);
}

export function paused(g, t, items, sel, touch) {
  veil(g, .68); heading(g, 'PAUSA', 250); menu(g, t, items, sel, MENU_POS.pause[0], MENU_POS.pause[1]); controlsHint(g, H - 24, touch);
}

export function options(g, t, items, sel, dark, touch) {
  veil(g, dark); heading(g, 'OPZIONI', 220); menu(g, t, items, sel, MENU_POS.options[0], MENU_POS.options[1]);
  txt(g, touch ? 'TOCCA una voce per cambiarla' : 'SINISTRA / DESTRA  cambia        ESC · B  indietro', W / 2, H - 24, `500 13px ${FONT}`, DIM, 1.5, 'center');
}

// ---------------------------------------------------------------- sfida online
function cancelButton(g, label) {
  g.strokeStyle = 'rgba(226,230,255,.35)'; g.lineWidth = 2;
  g.beginPath(); g.roundRect(W / 2 - 150, 632, 300, 46, 23); g.stroke();
  txt(g, label, W / 2 + 2, 662, `600 16px ${FONT}`, 'rgba(226,230,255,.8)', 4, 'center');
}

export function multi(g, t, items, sel, touch) {
  veil(g, .64); heading(g, 'SFIDA ONLINE', 210);
  txt(g, 'DUE GIOCATORI · STESSE MAPPE · VINCE CHI RESTA IN GIOCO', W / 2 + 3, 252, `600 14px ${FONT}`, CYAN, 5, 'center');
  menu(g, t, items, sel, MENU_POS.multi[0], MENU_POS.multi[1]);
  txt(g, 'Ogni mostro che mangi entra nella mappa del tuo avversario.', W / 2, H - 50, `500 14px ${FONT}`, 'rgba(226,230,255,.7)', .5, 'center');
  txt(g, touch ? 'TOCCA una voce per sceglierla' : 'INVIO · A  conferma        ESC · B  indietro', W / 2, H - 24, `500 13px ${FONT}`, DIM, 1.5, 'center');
}

// info: { mode: 'quick' | 'host' | 'join', status: 'connecting' | 'waiting' | 'error', code, error }
export function mpWait(g, t, info, touch) {
  veil(g, .7); heading(g, 'SFIDA ONLINE', 190);
  const dots = '.'.repeat(1 + Math.floor(t * 2) % 3);
  if (info.status === 'error') {
    txt(g, info.error || 'Collegamento non riuscito', W / 2, 360, `600 24px ${FONT}`, '#ff8a7a', 2, 'center');
    cancelButton(g, 'INDIETRO');
    return;
  }
  if (info.mode === 'host' && info.code) {
    txt(g, 'CODICE DELLA PARTITA', W / 2 + 3, 292, `600 15px ${FONT}`, DIM, 6, 'center');
    g.save(); g.shadowColor = '#ff7a1e'; g.shadowBlur = 30;
    txt(g, info.code.split('').join(' '), W / 2 + 10, 390, `700 92px ${FONT}`, ORANGE, 10, 'center');
    g.restore();
    txt(g, 'Comunicalo al tuo avversario: lo inserisce in "Entra con codice".', W / 2, 446, `500 16px ${FONT}`, 'rgba(226,230,255,.8)', .5, 'center');
    txt(g, 'IN ATTESA DELL\'AVVERSARIO' + dots, W / 2 + 3, 520, `600 16px ${FONT}`, CYAN, 5, 'center');
  } else {
    const s = info.status === 'connecting' ? 'COLLEGAMENTO' : info.mode === 'quick' ? 'RICERCA DI UN AVVERSARIO' : 'COLLEGAMENTO';
    txt(g, s + dots, W / 2 + 3, 370, `600 24px ${FONT}`, CYAN, 6, 'center');
    if (info.mode === 'quick' && info.status === 'waiting')
      txt(g, 'La partita comincia appena un altro giocatore sceglie "Partita veloce".', W / 2, 420, `500 16px ${FONT}`, 'rgba(226,230,255,.8)', .5, 'center');
  }
  cancelButton(g, 'ANNULLA');
  if (!touch) txt(g, 'ESC · B  annulla', W / 2, H - 16, `500 13px ${FONT}`, DIM, 1.5, 'center');
}

export function mpJoin(g, t, code, sel, touch) {
  veil(g, .72); heading(g, 'ENTRA CON CODICE', 150);
  txt(g, 'INSERISCI IL CODICE DI 5 CIFRE', W / 2 + 3, 196, `600 14px ${FONT}`, DIM, 5, 'center');
  for (let i = 0; i < 5; i++) {                       // le cinque caselle del codice
    const x = W / 2 - 190 + i * 78, on = i === code.length && Math.sin(t * 7) > 0;
    g.strokeStyle = i < code.length ? ORANGE : on ? CYAN : 'rgba(226,230,255,.3)'; g.lineWidth = 2.5;
    g.beginPath(); g.roundRect(x, 222, 66, 80, 10); g.stroke();
    if (i < code.length) txt(g, code[i], x + 33, 282, `700 54px ${FONT}`, WHITE, 0, 'center');
  }
  KEYS.forEach((k, i) => {
    const x = KP.x + (i % 3) * KP.w, y = KP.y + Math.floor(i / 3) * KP.h, on = i === sel;
    const ok = k === 'OK', ready = code.length === 5;
    g.fillStyle = on ? 'rgba(255,150,60,.24)' : 'rgba(226,230,255,.06)';
    g.beginPath(); g.roundRect(x + 5, y + 5, KP.w - 10, KP.h - 10, 12); g.fill();
    g.strokeStyle = on ? ORANGE : 'rgba(226,230,255,.22)'; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
    const col = ok ? (ready ? CYAN : 'rgba(226,230,255,.3)') : on ? ORANGE : WHITE;
    txt(g, k === '<' ? '⌫' : k, x + KP.w / 2 + (ok ? 2 : 0), y + KP.h / 2 + 11, `700 ${ok ? 24 : 30}px ${FONT}`, col, ok ? 3 : 0, 'center');
  });
  cancelButton(g, 'INDIETRO');
  if (!touch) txt(g, 'TASTIERA  cifre e INVIO        ESC · B  indietro', W / 2, H - 16, `500 13px ${FONT}`, DIM, 1.5, 'center');
}

export function mpNick(g, t, draft, sel, touch) {
  veil(g, .72); heading(g, 'IL TUO NOME', 150);
  txt(g, 'LO VEDE IL TUO AVVERSARIO NELLE SFIDE ONLINE', W / 2 + 3, 196, `600 14px ${FONT}`, DIM, 5, 'center');
  g.strokeStyle = ORANGE; g.lineWidth = 2.5; g.beginPath(); g.roundRect(W / 2 - 230, 224, 460, 70, 12); g.stroke();
  const shown = draft + (draft.length < NICK_MAX && Math.sin(t * 7) > 0 ? '_' : '');
  txt(g, shown, W / 2 + 4, 274, `700 44px ${FONT}`, WHITE, 6, 'center');
  NICK_KEYS.forEach((k, i) => {
    const x = NK.x + (i % 10) * NK.w, y = NK.y + Math.floor(i / 10) * NK.h, on = i === sel, ok = k === 'OK';
    g.fillStyle = on ? 'rgba(255,150,60,.24)' : 'rgba(226,230,255,.06)';
    g.beginPath(); g.roundRect(x + 4, y + 4, NK.w - 8, NK.h - 8, 10); g.fill();
    g.strokeStyle = on ? ORANGE : 'rgba(226,230,255,.22)'; g.lineWidth = on ? 2.5 : 1.5; g.stroke();
    const col = ok ? (draft.length ? CYAN : 'rgba(226,230,255,.3)') : on ? ORANGE : WHITE;
    txt(g, k === '<' ? '⌫' : k, x + NK.w / 2 + (ok ? 1 : 0), y + NK.h / 2 + 10, `700 ${ok ? 20 : 26}px ${FONT}`, col, ok ? 2 : 0, 'center');
  });
  cancelButton(g, 'INDIETRO');
  if (!touch) txt(g, 'TASTIERA  scrivi e INVIO        ESC · B  indietro', W / 2, H - 16, `500 13px ${FONT}`, DIM, 1.5, 'center');
}

// Colonna dell'avversario: nome, cornice del riquadro e, sotto, punti, sonde, settore ed energia.
export function versusSide(g, p, name) {
  const x = VS_PIP.x, y = VS_PIP.y, w = W * VS_PIP.s, h = H * VS_PIP.s, hp = p.prm.pal.pel;
  const lab = `600 11px ${FONT}`, dim = 'rgba(200,205,255,.55)', b = y + h;
  txt(g, name || 'AVVERSARIO', x, y - 14, `700 16px ${FONT}`, CYAN, name && name.length > 8 ? 2 : 5);
  g.strokeStyle = p.phase === 'hit' ? '#ff5a4a' : CYAN; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, w + 2, h + 2);
  txt(g, 'PUNTI', x, b + 30, lab, dim, 3);
  txt(g, String(p.score).padStart(6, '0'), x, b + 68, `700 38px ${FONT}`, WHITE, 3);
  txt(g, 'SONDE', x, b + 100, lab, dim, 3);
  for (let i = 0; i < Math.max(3, p.lives); i++) {
    const lx = x + 8 + i * 28, on = i < p.lives;
    g.fillStyle = on ? '#ff9d3c' : 'rgba(200,205,255,.16)'; g.beginPath(); g.roundRect(lx - 8, b + 110, 13, 14, 4); g.fill();
    g.beginPath(); g.moveTo(lx + 6, b + 110); g.lineTo(lx + 15, b + 117); g.lineTo(lx + 6, b + 124); g.closePath();
    g.fillStyle = on ? '#dfe3ff' : 'rgba(200,205,255,.16)'; g.fill();
  }
  g.fillStyle = 'rgba(200,205,255,.16)'; g.fillRect(x, b + 130, 100, 3);          // mostri mangiati verso la prossima sonda
  g.fillStyle = '#ff9d3c'; g.fillRect(x, b + 130, 100 * ((p.eaten | 0) % MONSTERS_PER_LIFE) / MONSTERS_PER_LIFE, 3);
  txt(g, 'SETTORE', x + 150, b + 100, lab, dim, 3);
  txt(g, p.bonusStage ? 'BONUS' : String(p.level).padStart(2, '0'), x + 150, b + 126, `700 ${p.bonusStage ? 18 : 22}px ${FONT}`, WHITE, 2);
  txt(g, 'ENERGIA', x, b + 164, lab, dim, 3);
  const segs = 22, lit = Math.ceil(p.energy * segs), low = p.energy < .25;
  for (let i = 0; i < segs; i++) {
    g.fillStyle = i < lit ? (low ? '#ff5a4a' : `hsl(${hp},100%,${62 + 14 * (i / segs)}%)`) : 'rgba(200,205,255,.14)';
    g.fillRect(x + i * 10.9, b + 173, 8, 11);
  }
}

export function versusMenu(g, t, items, sel) {
  veil(g, .6); heading(g, 'SFIDA IN CORSO', 250);
  txt(g, 'LA PARTITA NON SI FERMA', W / 2 + 3, 290, `600 14px ${FONT}`, '#ff8a7a', 5, 'center');
  menu(g, t, items, sel, MENU_POS.vsmenu[0], MENU_POS.vsmenu[1]);
}

// res: { kind: 'win' | 'lose' | 'draw' | 'forfeit' | 'offline', mine, theirs, note }
export function versusEnd(g, t, res, items, sel) {
  veil(g, .76);
  const won = res.kind === 'win' || res.kind === 'forfeit';
  const title = won ? 'HAI VINTO' : res.kind === 'lose' ? 'HAI PERSO' : res.kind === 'draw' ? 'PAREGGIO' : 'SFIDA INTERROTTA';
  g.save(); g.shadowColor = won ? '#3fe0ff' : '#ff7a1e'; g.shadowBlur = 40;
  txt(g, title, W / 2 + 10, 230, `700 84px ${FONT}`, won ? CYAN : ORANGE, 14, 'center');
  g.restore();
  if (res.note) txt(g, res.note, W / 2 + 3, 276, `600 15px ${FONT}`, DIM, 4, 'center');
  [[res.myName || 'TU', res.mine, ORANGE], [res.theirName || 'AVVERSARIO', res.theirs, CYAN]].forEach(([name, score, col], i) => {
    const x = W / 2 + (i ? 170 : -170);
    txt(g, name, x + 3, 348, `700 16px ${FONT}`, col, 5, 'center');
    txt(g, String(score).padStart(6, '0'), x + 3, 410, `700 56px ${FONT}`, WHITE, 4, 'center');
  });
  menu(g, t, items, sel, MENU_POS.vsend[0], MENU_POS.vsend[1]);
}

// Comandi a schermo durante la partita. stick = levetta attiva in coordinate di gioco
// ({ ox, oy, x, y, r }) oppure null; retract = pollice destro appoggiato.
export function touchControls(g, stick, retract) {
  g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  // levetta: dove si appoggia il dito, altrimenti il segnaposto in basso a sinistra
  const cx = stick ? stick.ox : 150, cy = stick ? stick.oy : H - 150, r = stick ? stick.r : 62, a = stick ? .45 : .2;
  g.strokeStyle = `rgba(226,230,255,${a})`; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
  g.fillStyle = `rgba(226,230,255,${a})`;
  for (let i = 0; i < 4; i++) {
    const ang = i * Math.PI / 2, ux = Math.cos(ang), uy = Math.sin(ang), d = r - 16;
    g.beginPath(); g.moveTo(cx + ux * (d + 9), cy + uy * (d + 9));
    g.lineTo(cx + ux * d - uy * 8, cy + uy * d + ux * 8); g.lineTo(cx + ux * d + uy * 8, cy + uy * d - ux * 8); g.closePath(); g.fill();
  }
  if (stick) { g.fillStyle = 'rgba(255,184,104,.55)'; g.beginPath(); g.arc(stick.x, stick.y, r * .42, 0, 6.283); g.fill(); }

  // ritiro del tubo
  const bx = W - 150, by = H - 150;
  g.fillStyle = retract ? 'rgba(255,157,60,.4)' : 'rgba(255,157,60,.1)'; g.beginPath(); g.arc(bx, by, 66, 0, 6.283); g.fill();
  g.strokeStyle = `rgba(255,184,104,${retract ? .9 : .4})`; g.beginPath(); g.arc(bx, by, 66, 0, 6.283); g.stroke();
  txt(g, 'RITIRA', bx + 2, by + 6, `700 16px ${FONT}`, `rgba(255,214,170,${retract ? 1 : .6})`, 4, 'center');

  // pausa
  g.fillStyle = 'rgba(6,6,20,.6)'; g.beginPath(); g.arc(PAUSE_BTN.x, PAUSE_BTN.y, 19, 0, 6.283); g.fill();
  g.fillStyle = 'rgba(226,230,255,.8)'; g.fillRect(PAUSE_BTN.x - 7, PAUSE_BTN.y - 8, 5, 16); g.fillRect(PAUSE_BTN.x + 2, PAUSE_BTN.y - 8, 5, 16);
}

export function gameOver(g, t, res, scores, touch) {
  veil(g, .74); heading(g, res.won ? 'MISSIONE COMPIUTA' : 'FINE PARTITA', 170);
  txt(g, 'PUNTI', W / 2 + 2, 222, `600 13px ${FONT}`, DIM, 5, 'center');
  txt(g, String(res.score).padStart(6, '0'), W / 2 + 4, 274, `700 52px ${FONT}`, WHITE, 6, 'center');
  txt(g, res.won ? 'HAI COMPLETATO TUTTI I SETTORI' : 'SETTORE RAGGIUNTO  ' + String(res.level).padStart(2, '0'), W / 2 + 2, 306, `600 14px ${FONT}`, res.won ? CYAN : DIM, 4, 'center');
  if (res.record && Math.sin(t * 7) > -.4) txt(g, 'NUOVO RECORD', W / 2 + 4, 344, `700 22px ${FONT}`, CYAN, 8, 'center');

  txt(g, 'CLASSIFICA', W / 2 + 2, 396, `600 13px ${FONT}`, DIM, 5, 'center');
  scores.forEach((s, i) => {
    const y = 432 + i * 34, mine = i === res.rank, col = mine ? ORANGE : 'rgba(226,230,255,.78)', f = `${mine ? 700 : 600} 20px ${FONT}`;
    txt(g, (i + 1) + '.', W / 2 - 250, y, f, col, 2);
    txt(g, String(s.score).padStart(6, '0'), W / 2 - 200, y, f, col, 3);
    txt(g, 'SETTORE ' + String(s.level).padStart(2, '0'), W / 2 - 40, y, `600 15px ${FONT}`, col, 3);
    txt(g, s.date || '', W / 2 + 250, y, `500 14px ${FONT}`, DIM, 1, 'right');
  });
  if (Math.sin(t * 4) > -.3) txt(g, touch ? 'TOCCA lo schermo per continuare' : 'INVIO · A  per continuare', W / 2, H - 30, `600 14px ${FONT}`, DIM, 3, 'center');
}
