// Schermate sovrapposte al gioco: titolo, menu, opzioni, fine partita.
// Tutte disegnano in coordinate logiche 1280x720 (il contesto è già scalato).
import { W, H, FONT, PAUSE_BTN } from './config.js';
import { txt } from './render.js';

const ORANGE = '#ffb868', DIM = 'rgba(200,205,255,.55)', WHITE = '#f2f4ff', CYAN = 'hsl(186,100%,74%)';

// Posizione delle voci dei menu: [y della prima voce, passo]. Serve anche per riconoscere i tocchi.
export const MENU_POS = { title: [392, 48], pause: [340, 48], options: [320, 52] };
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
      if (on) txt(g, '◂  ▸', W / 2 + 20, y - 2, `600 16px ${FONT}`, ORANGE, 0, 'center');
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
  txt(g, 'I pallini grossi rallentano i mostri. Il tubo si ritira solo con ' + (touch ? 'il pollice destro.' : 'SPAZIO (A sul gamepad).'), W / 2, H - 50, `500 14px ${FONT}`, 'rgba(226,230,255,.7)', .5, 'center');
  controlsHint(g, H - 24, touch);
}

export function paused(g, t, items, sel, touch) {
  veil(g, .68); heading(g, 'PAUSA', 250); menu(g, t, items, sel, MENU_POS.pause[0], MENU_POS.pause[1]); controlsHint(g, H - 24, touch);
}

export function options(g, t, items, sel, dark, touch) {
  veil(g, dark); heading(g, 'OPZIONI', 220); menu(g, t, items, sel, MENU_POS.options[0], MENU_POS.options[1]);
  txt(g, touch ? 'TOCCA una voce per cambiarla' : 'SINISTRA / DESTRA  cambia        ESC · B  indietro', W / 2, H - 24, `500 13px ${FONT}`, DIM, 1.5, 'center');
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
  veil(g, .74); heading(g, 'FINE PARTITA', 170);
  txt(g, 'PUNTI', W / 2 + 2, 222, `600 13px ${FONT}`, DIM, 5, 'center');
  txt(g, String(res.score).padStart(6, '0'), W / 2 + 4, 274, `700 52px ${FONT}`, WHITE, 6, 'center');
  txt(g, 'SETTORE RAGGIUNTO  ' + String(res.level).padStart(2, '0'), W / 2 + 2, 306, `600 14px ${FONT}`, DIM, 4, 'center');
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
