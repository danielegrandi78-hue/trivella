// Disegno: sfondo del settore, luci, sonda, mostri, effetti, barra di stato.
import { W, H, GROUND, NY, SP, Y0, TW, N, NX, ENTRY, RIGP, FONT, KINDS, POWERS, MAX_LIVES, MONSTERS_PER_LIFE, nodes, P, rng } from './config.js';

function makeGlow(h, s, l, soft) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  const col = a => `hsla(${h},${s}%,${l}%,${a})`;
  if (soft) { gr.addColorStop(0, col(1)); gr.addColorStop(.45, col(.62)); gr.addColorStop(1, col(0)); }
  else { gr.addColorStop(0, col(1)); gr.addColorStop(.25, col(.45)); gr.addColorStop(.6, col(.12)); gr.addColorStop(1, col(0)); }
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return c;
}
const glow = (g, sp, x, y, r, a) => { g.globalAlpha = a; g.drawImage(sp, x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; };

export function txt(g, s, x, y, font, color, ls, align) {
  g.font = font; g.letterSpacing = (ls || 0) + 'px'; g.textAlign = align || 'left'; g.fillStyle = color; g.fillText(s, x, y);
}

export class Renderer {
  constructor(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.lightCv = document.createElement('canvas'); this.lctx = this.lightCv.getContext('2d');
    this.S = 1; this.slots = [];        // sfondi già disegnati, uno per riquadro (due nello schermo diviso)
    this.GLIGHT = makeGlow(0, 0, 100, true);
    this.GO = makeGlow(28, 100, 60); this.GR = makeGlow(0, 100, 60); this.GWH = makeGlow(40, 100, 92);
    this.GGOLD = makeGlow(48, 100, 62); this.GICE = makeGlow(195, 100, 75);
    this.GC = KINDS.map(k => makeGlow(k.hue, 100, 62));
    this.GPW = POWERS.map(p => makeGlow(p.hue, 100, 66));
    this.GP = null;
    this.fit();
    addEventListener('resize', () => this.fit());
  }

  fit() {
    // lo spazio disponibile è quello del contenitore, che esclude tacca e bordi arrotondati dei telefoni
    const cv = this.cv, box = cv.parentElement, bw = box.clientWidth || innerWidth, bh = box.clientHeight || innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), k = Math.min(bw / W, bh / H) || 1;
    cv.style.width = Math.round(W * k) + 'px'; cv.style.height = Math.round(H * k) + 'px';
    this.S = Math.max(.25, Math.min(k * dpr, 2.5));
    cv.width = Math.round(W * this.S); cv.height = Math.round(H * this.S);
    this.lightCv.width = Math.round(W * this.S / 2); this.lightCv.height = Math.round(H * this.S / 2);
    this.slots = [];
  }

  // ------------------------------------------------------------ sfondo (una volta per settore)
  buildBg(game) {
    const S = this.S, pal = game.prm.pal, hr = pal.rock, hp = pal.pel, adj = game.L.adj;
    const bg = document.createElement('canvas'); bg.width = this.cv.width; bg.height = this.cv.height;
    const g = bg.getContext('2d'); g.scale(S, S);
    const r = rng(77 + game.level * 13 + (game.seed | 0));

    // cielo: colori dell'ambientazione, stelle, bagliore all'orizzonte in un punto casuale
    let gr = g.createLinearGradient(0, 0, 0, GROUND);
    gr.addColorStop(0, pal.sky[0]); gr.addColorStop(.45, pal.sky[1]); gr.addColorStop(.8, pal.sky[2]); gr.addColorStop(1, pal.sky[3]);
    g.fillStyle = gr; g.fillRect(0, 0, W, GROUND);
    for (let i = 0; i < 150; i++) {
      const x = r() * W, y = r() * GROUND * .78, a = (.2 + r() * .8) * (1 - y / GROUND), s = r() < .12 ? 1.7 : .9;
      g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, s, s);
    }
    const sunX = 120 + r() * (W - 240);
    g.globalCompositeOperation = 'lighter';
    gr = g.createRadialGradient(sunX, GROUND, 0, sunX, GROUND, 300);
    gr.addColorStop(0, `rgba(${pal.glow},.55)`); gr.addColorStop(.4, `rgba(${pal.glow},.16)`); gr.addColorStop(1, `rgba(${pal.glow},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, GROUND);
    g.globalCompositeOperation = 'source-over';

    // pianeta (a volte con anello) e una o due lune, lontani dalla torre
    const away = () => { for (let k = 0; k < 30; k++) { const x = 110 + r() * (W - 220); if (Math.abs(x - RIGP.x) > 210) return x; } return RIGP.x > W / 2 ? 200 : W - 200; };
    const px = away(), py = 66 + r() * 26, pr = 22 + r() * 16, ph = r() * 360, tilt = -.5 + r(), ring = r() < .6;
    if (ring) { g.strokeStyle = `hsla(${ph + 30},80%,85%,.5)`; g.lineWidth = pr * .1; g.beginPath(); g.ellipse(px, py, pr * 1.85, pr * .4, tilt, Math.PI, Math.PI * 2); g.stroke(); }
    gr = g.createRadialGradient(px - pr * .35, py - pr * .4, 2, px, py, pr * 1.05);
    gr.addColorStop(0, `hsl(${ph},85%,84%)`); gr.addColorStop(.55, `hsl(${ph + 25},55%,50%)`); gr.addColorStop(1, `hsl(${ph + 50},60%,18%)`);
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, pr, 0, 6.283); g.fill();
    if (ring) { g.strokeStyle = `hsla(${ph + 30},80%,88%,.8)`; g.beginPath(); g.ellipse(px, py, pr * 1.85, pr * .4, tilt, 0, Math.PI); g.stroke(); }
    for (let m = 0, cnt = 1 + (r() < .4 ? 1 : 0); m < cnt; m++) {
      let mx = away(); if (Math.abs(mx - px) < 110) mx = (mx + W / 2) % (W - 200) + 100;
      const my = 46 + r() * 40, mr = 6 + r() * 7;
      gr = g.createRadialGradient(mx - mr * .35, my - mr * .35, 1, mx, my, mr);
      gr.addColorStop(0, '#f2eaff'); gr.addColorStop(1, `hsl(${hr + 20},30%,45%)`);
      g.fillStyle = gr; g.beginPath(); g.arc(mx, my, mr, 0, 6.283); g.fill();
    }

    // creste rocciose
    const ridge = (col, lo, hi, step) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, GROUND);
      for (let x = 0; x <= W + step; x += step) g.lineTo(x + (r() - .5) * step * .5, GROUND - lo - r() * (hi - lo));
      g.lineTo(W, GROUND); g.closePath(); g.fill();
    };
    ridge(`hsl(${hr + 25},42%,24%)`, 18, 58, 46);
    ridge(`hsl(${hr + 8},48%,12%)`, 6, 30, 30);

    // roccia a strati
    gr = g.createLinearGradient(0, GROUND, 0, H);
    gr.addColorStop(0, `hsl(${hr},44%,33%)`); gr.addColorStop(.5, `hsl(${hr + 8},50%,24%)`); gr.addColorStop(1, `hsl(${hr + 16},56%,15%)`);
    g.fillStyle = gr; g.fillRect(0, GROUND, W, H - GROUND);
    for (let b = 0; b < 8; b++) {
      const y0 = GROUND + 26 + b * 72 + r() * 20, th = 16 + r() * 30, f = .004 + r() * .006, ph = r() * 9, am = 6 + r() * 12;
      g.fillStyle = `hsla(${hr + r() * 40 - 20},50%,${r() < .5 ? 46 : 12}%,.22)`;
      g.beginPath(); g.moveTo(0, y0);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, y0 + Math.sin(x * f + ph) * am);
      for (let x = W; x >= 0; x -= 20) g.lineTo(x, y0 + th + Math.sin(x * f * 1.3 + ph + 1) * am);
      g.closePath(); g.fill();
    }
    for (let i = 0; i < 280; i++) {
      g.fillStyle = `hsla(${hr + r() * 40 - 20},40%,${r() < .5 ? 50 : 10}%,.08)`;
      g.beginPath(); g.ellipse(r() * W, GROUND + r() * (H - GROUND), 10 + r() * 46, 5 + r() * 18, r() * 3, 0, 6.283); g.fill();
    }
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `hsla(${hr + 20},50%,${50 + r() * 30}%,${.05 + r() * .16})`;
      const s = r() < .2 ? 1.8 : 1; g.fillRect(r() * W, GROUND + r() * (H - GROUND), s, s);
    }
    for (let i = 0; i < 50; i++) {
      const x = r() * W, y = GROUND + 20 + r() * (H - GROUND - 20), s = 2 + r() * 3.5;
      g.fillStyle = `hsla(${hp + r() * 40 - 20},90%,72%,${.2 + r() * .3})`;
      g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * .7, y); g.lineTo(x, y + s); g.lineTo(x - s * .7, y); g.closePath(); g.fill();
    }
    gr = g.createLinearGradient(0, GROUND, 0, GROUND + 22);
    gr.addColorStop(0, `rgba(${pal.glow},.4)`); gr.addColorStop(1, `rgba(${pal.glow},0)`);
    g.fillStyle = gr; g.fillRect(0, GROUND, W, 22);
    g.fillStyle = pal.sky[3]; g.fillRect(0, GROUND - 1, W, 2);

    // cunicoli: pozzo d'ingresso, tutti i tratti della mappa, corsie prolungate fuori schermo
    const tun = new Path2D();
    tun.moveTo(RIGP.x, GROUND + 4); tun.lineTo(nodes[ENTRY].x, nodes[ENTRY].y);
    for (let u = 0; u < N; u++) for (const v of adj[u]) if (u < v) { tun.moveTo(nodes[u].x, nodes[u].y); tun.lineTo(nodes[v].x, nodes[v].y); }
    for (const j of game.L.lanes) {
      const y = Y0 + j * SP;
      tun.moveTo(-60, y); tun.lineTo(nodes[0].x, y); tun.moveTo(nodes[NX - 1].x, y); tun.lineTo(W + 60, y);
    }
    // ogni strato: gallerie come linee spesse, caverne come rettangoli pieni della stessa misura
    const layer = (col, w) => {
      g.strokeStyle = col; g.lineWidth = w; g.stroke(tun);
      g.fillStyle = col;
      for (const m of game.L.rooms) {
        const x0 = nodes[m.c0].x - w / 2, y0 = Y0 + m.r0 * SP - w / 2;
        g.beginPath(); g.roundRect(x0, y0, (m.c1 - m.c0) * SP + w, (m.r1 - m.r0) * SP + w, w / 2); g.fill();
      }
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    layer(`hsla(${hp},90%,60%,.09)`, TW + 14);
    layer(`hsl(${hr},46%,52%)`, TW + 4);                       // bordo chiaro: i cunicoli si staccano dalla roccia
    layer('#080b1a', TW);
    g.strokeStyle = `hsla(${hr - 25},55%,24%,.5)`; g.lineWidth = TW - 15; g.stroke(tun);
    layer('#090c1e', 6);                 // il pavimento delle caverne resta aperto, senza la trama dei cunicoli
    return bg;
  }

  // Pulisce tutto lo schermo: serve prima di disegnare più riquadri nello stesso fotogramma.
  clear() {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#03040a'; g.fillRect(0, 0, this.cv.width, this.cv.height);
    g.setTransform(this.S, 0, 0, this.S, 0, 0);
  }

  // ------------------------------------------------------------ elementi di scena
  drawRig(g, game, t) {
    const hp = game.prm.pal.pel, dark = '#130a24';
    g.save(); g.translate(RIGP.x, GROUND);
    g.fillStyle = dark; g.fillRect(-60, -7, 120, 9);
    g.fillStyle = 'rgba(255,175,115,.85)'; g.fillRect(-60, -7, 120, 1.5);
    const hw = h => 25 - 19 * h / 80;
    g.strokeStyle = dark; g.lineCap = 'round'; g.lineWidth = 3.6;
    g.beginPath(); g.moveTo(-25, -7); g.lineTo(-6, -87); g.moveTo(25, -7); g.lineTo(6, -87); g.stroke();
    g.lineWidth = 1.8; g.beginPath();
    for (let i = 0; i < 4; i++) {
      const h0 = i * 20, h1 = h0 + 20, w0 = hw(h0), w1 = hw(h1);
      g.moveTo(-w0, -7 - h0); g.lineTo(w1, -7 - h1); g.moveTo(w0, -7 - h0); g.lineTo(-w1, -7 - h1); g.moveTo(-w1, -7 - h1); g.lineTo(w1, -7 - h1);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,150,100,.55)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-26.5, -7); g.lineTo(-7.5, -87); g.stroke();
    g.fillStyle = dark; g.fillRect(-10, -94, 20, 8);
    g.fillRect(32, -29, 26, 22); g.fillRect(50, -40, 2, 12);
    g.fillStyle = `hsl(${hp},100%,72%)`; g.fillRect(37, -24, 9, 6);
    g.strokeStyle = '#ff9d3c'; g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(-40, -32); g.lineTo(0, -90); g.lineTo(0, 0); g.stroke();
    g.fillStyle = dark; g.beginPath(); g.arc(-40, -20, 13, 0, 6.283); g.fill();
    g.strokeStyle = '#ff9d3c'; g.lineWidth = 2; g.beginPath(); g.arc(-40, -20, 10, 0, 6.283); g.stroke();
    g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i < 3; i++) { const a = game.reel / 10 + i * 2.094; g.moveTo(-40, -20); g.lineTo(-40 + Math.cos(a) * 10, -20 + Math.sin(a) * 10); }
    g.stroke();
    const bl = .5 + .5 * Math.sin(t * 5);
    g.fillStyle = `rgba(255,70,70,${.5 + .5 * bl})`; g.beginPath(); g.arc(0, -97, 2.6, 0, 6.283); g.fill();
    g.globalCompositeOperation = 'lighter';
    glow(g, this.GR, 0, -97, 20, .3 + .6 * bl); glow(g, this.GP, 41, -21, 20, .55); glow(g, this.GO, 0, -4, 40, .5);
    g.globalCompositeOperation = 'source-over';
    g.restore();
  }

  eyes(g, x, oy, r) {
    for (const s of [-1, 1]) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, oy * s, r, 0, 6.283); g.fill();
      g.fillStyle = '#0a0618'; g.beginPath(); g.arc(x + r * .4, oy * s, r * .5, 0, 6.283); g.fill();
    }
  }

  drawCreature(g, c, time, frozen) {
    const k = Math.min(1, c.age / .4), h = KINDS[c.kind].hue, t = frozen ? time * .25 : time;
    g.globalCompositeOperation = 'lighter'; glow(g, this.GC[c.kind], c.x, c.y, 34, .6 * k); g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(c.x, c.y); g.scale(k, k); if (c.dir < 0) g.scale(-1, 1);
    const body = r0 => { const gr = g.createRadialGradient(2, -3, 1, 0, 0, r0 + 2); gr.addColorStop(0, `hsl(${h},100%,90%)`); gr.addColorStop(.55, `hsl(${h},95%,62%)`); gr.addColorStop(1, `hsl(${h},90%,34%)`); return gr; };
    if (c.kind === 0) {                       // medusa
      g.strokeStyle = `hsla(${h},100%,72%,.85)`; g.lineWidth = 2; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-6, i * 5); for (let s = 1; s <= 4; s++) g.lineTo(-6 - s * 4, i * 5 + Math.sin(t * 9 + c.ph + s * 1.1 + i) * 2.8); g.stroke(); }
      g.beginPath();
      for (let i = 0; i <= 18; i++) { const a = i / 18 * 6.283, rr = 10.5 * (1 + .1 * Math.sin(a * 3 + t * 7 + c.ph)); i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fillStyle = body(10.5); g.fill(); this.eyes(g, 3.5, 4.2, 2.9);
    } else if (c.kind === 1) {                // riccio
      g.save(); g.rotate(t * 3 + c.ph); g.beginPath();
      for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283, rr = i % 2 ? 7.5 : 13.5; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      g.closePath(); g.fillStyle = body(12); g.fill(); g.restore();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(1, 0, 4.4, 0, 6.283); g.fill();
      g.fillStyle = '#0a0618'; g.beginPath(); g.arc(2.8, 0, 2.2, 0, 6.283); g.fill();
    } else if (c.kind === 2) {                // larva
      for (let s = 3; s >= 1; s--) { g.fillStyle = `hsl(${h},90%,${58 - s * 8}%)`; g.beginPath(); g.arc(-s * 6.5, Math.sin(t * 10 + c.ph + s * 1.3) * 2.4, 8.5 - s * 1.4, 0, 6.283); g.fill(); }
      g.fillStyle = body(9.5); g.beginPath(); g.arc(0, 0, 9.5, 0, 6.283); g.fill(); this.eyes(g, 3.5, 3.9, 2.7);
    } else {                                  // magma: corazzato, non si mangia
      const pulse = .5 + .5 * Math.sin(t * 6 + c.ph);
      g.save(); g.rotate(t * 1.2 + c.ph); g.fillStyle = '#1c0a0a';
      for (let i = 0; i < 8; i++) { g.rotate(6.283 / 8); g.beginPath(); g.moveTo(9, -4); g.lineTo(16.5, 0); g.lineTo(9, 4); g.closePath(); g.fill(); }
      g.restore();
      const gr = g.createRadialGradient(-2, -3, 1, 0, 0, 12); gr.addColorStop(0, '#6a2416'); gr.addColorStop(1, '#170606');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 11.5, 0, 6.283); g.fill();
      g.strokeStyle = `hsl(${14 + pulse * 22},100%,${52 + pulse * 18}%)`; g.lineWidth = 1.7; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-9, -3); g.lineTo(-4, 1); g.lineTo(-6, 7); g.moveTo(-4, 1); g.lineTo(1, -2); g.lineTo(0, -9); g.moveTo(1, -2); g.lineTo(5, 5); g.lineTo(2, 9); g.stroke();
      g.fillStyle = '#ffd84a';
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(5.5, s * 3.6, 3, 1.2, s * .5, 0, 6.283); g.fill(); }
    }
    g.restore();
    if (frozen) {
      g.strokeStyle = 'rgba(190,240,255,.85)'; g.lineWidth = 1.6; g.beginPath(); g.arc(c.x, c.y, 16, 0, 6.283); g.stroke();
      g.globalCompositeOperation = 'lighter'; glow(g, this.GICE, c.x, c.y, 26, .5); g.globalCompositeOperation = 'source-over';
    }
  }

  drawHead(g, game, h, t) {
    const hp = game.prm.pal.pel;
    g.globalCompositeOperation = 'lighter'; glow(g, this.GO, h.x, h.y, 62, .75); glow(g, this.GWH, h.x, h.y, 26, .5); g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(h.x, h.y); g.rotate(game.headAng);
    g.beginPath(); g.moveTo(5, -10.5); g.lineTo(23, 0); g.lineTo(5, 10.5); g.closePath();
    let gr = g.createLinearGradient(0, -10, 0, 10); gr.addColorStop(0, '#f4f6ff'); gr.addColorStop(.5, '#9aa3c4'); gr.addColorStop(1, '#3a4060');
    g.fillStyle = gr; g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(20,22,40,.75)'; g.lineWidth = 2;
    const off = (game.reel * .35 % 7 + 7) % 7;
    for (let x = -6 + off; x < 30; x += 7) { g.beginPath(); g.moveTo(x, -12); g.lineTo(x - 7, 12); g.stroke(); }
    g.restore();
    gr = g.createLinearGradient(0, -11, 0, 11); gr.addColorStop(0, '#ffd08a'); gr.addColorStop(.5, '#ff8f2e'); gr.addColorStop(1, '#a8420e');
    g.fillStyle = gr; g.beginPath(); g.roundRect(-11, -11, 17, 22, 6); g.fill();
    g.fillStyle = '#2a1608'; g.fillRect(3, -11, 2.5, 22);
    g.fillStyle = `hsl(${hp},100%,80%)`; g.beginPath(); g.arc(-3.5, 0, 3.6, 0, 6.283); g.fill();
    g.restore();
    if (game.fx.calamita > 0) {
      const a = (t * 1.6) % 1;
      g.strokeStyle = `hsla(${POWERS[2].hue},100%,75%,${.5 * a})`; g.lineWidth = 2;
      g.beginPath(); g.arc(h.x, h.y, 125 * (1 - a) + 14, 0, 6.283); g.stroke();
    }
  }

  drawPower(g, p, t) {
    const def = POWERS[p.kind], blink = p.life < 2.5 && Math.sin(t * 16) < 0;
    if (blink) return;
    const y = p.y + Math.sin(t * 3 + p.ph) * 2;
    g.globalCompositeOperation = 'lighter'; glow(g, this.GPW[p.kind], p.x, y, 42 + 4 * Math.sin(t * 4), .8); g.globalCompositeOperation = 'source-over';
    g.save(); g.translate(p.x, y);
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + .5236; i ? g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13) : g.moveTo(Math.cos(a) * 13, Math.sin(a) * 13); } g.closePath();
    g.fillStyle = '#0a0a1c'; g.fill(); g.strokeStyle = `hsl(${def.hue},100%,70%)`; g.lineWidth = 2; g.stroke();
    this.powerIcon(g, p.kind, 7, `hsl(${def.hue},100%,82%)`);
    g.restore();
  }
  // Simbolo del potenziamento centrato sull'origine.
  powerIcon(g, kind, s, color) {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = s * .28; g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 0) {            // gelo: fiocco
      g.beginPath(); for (let i = 0; i < 3; i++) { const a = i * 1.0472; g.moveTo(Math.cos(a) * s, Math.sin(a) * s); g.lineTo(-Math.cos(a) * s, -Math.sin(a) * s); } g.stroke();
    } else if (kind === 1) {     // scudo
      g.beginPath(); g.moveTo(-s * .8, -s * .8); g.lineTo(s * .8, -s * .8); g.lineTo(s * .8, 0); g.quadraticCurveTo(s * .7, s * .8, 0, s); g.quadraticCurveTo(-s * .7, s * .8, -s * .8, 0); g.closePath(); g.fill();
    } else if (kind === 2) {     // calamita: ferro di cavallo
      g.lineWidth = s * .5; g.lineCap = 'butt';
      g.beginPath(); g.moveTo(-s * .65, -s * .8); g.lineTo(-s * .65, s * .1); g.arc(0, s * .1, s * .65, Math.PI, 0, true); g.lineTo(s * .65, -s * .8); g.stroke();
    } else {                     // turbo: fulmine
      g.beginPath(); g.moveTo(s * .25, -s); g.lineTo(-s * .65, s * .15); g.lineTo(-s * .05, s * .15); g.lineTo(-s * .25, s); g.lineTo(s * .65, -s * .2); g.lineTo(s * .05, -s * .2); g.closePath(); g.fill();
    }
  }

  drawLight(game, h) {
    const g = this.lctx, S = this.S;
    g.setTransform(S / 2, 0, 0, S / 2, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, GROUND, 0, GROUND + 90);
    gr.addColorStop(0, 'rgba(2,2,10,0)'); gr.addColorStop(1, 'rgba(2,2,10,.26)');      // penombra leggera lontano dalla sonda
    g.fillStyle = gr; g.fillRect(0, GROUND, W, H - GROUND);
    g.globalCompositeOperation = 'destination-out';
    glow(g, this.GLIGHT, h.x, h.y, 250, 1);
    for (let i = 1; i < game.pipe.length; i += 2) { const p = P(game.pipe[i]); glow(g, this.GLIGHT, p.x, p.y, 74, .3); }
    for (const c of game.creatures) glow(g, this.GLIGHT, c.x, c.y, 84, .55);
    for (const p of game.L.pelList) if (p.alive && p.big) glow(g, this.GLIGHT, p.x, p.y, 78, .55);
    if (game.power) glow(g, this.GLIGHT, game.power.x, game.power.y, 90, .7);
  }

  // ------------------------------------------------------------ fotogramma
  // opt: hud (barra di stato completa) · phase (solo le scritte di fase) · hi (record)
  //      view { x, y, s } riquadro in cui disegnare, in coordinate di gioco (schermo diviso)
  //      slot numero del riquadro · pel raggio dei cristalli (più grandi nei riquadri piccoli)
  draw(game, opt) {
    opt = opt || {};
    const g = this.ctx, S = this.S, cv = this.cv, t = game.time, h = game.headPos(), hp = game.prm.pal.pel;
    const view = opt.view, vx = view ? view.x : 0, vy = view ? view.y : 0, vs = view ? view.s : 1, VS = S * vs;
    const pr = opt.pel || 2.7, pk = pr / 2.7;
    let slot = this.slots[opt.slot || 0];
    if (!slot || slot.game !== game || slot.key !== game.bgKey) {
      this.GP = makeGlow(hp, 100, 65);
      slot = this.slots[opt.slot || 0] = { game, key: game.bgKey, bg: this.buildBg(game), GP: this.GP };
    }
    this.GP = slot.GP;
    const sx = game.shake ? (Math.random() - .5) * game.shake : 0, sy = game.shake ? (Math.random() - .5) * game.shake : 0;
    const ox = (vx + sx * vs) * S, oy = (vy + sy * vs) * S;      // origine del riquadro in pixel, tremolio compreso
    if (!view) this.clear();
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (view) { g.beginPath(); g.rect(vx * S, vy * S, W * VS, H * VS); g.clip(); }
    g.drawImage(slot.bg, ox, oy, cv.width * vs, cv.height * vs);
    g.setTransform(VS, 0, 0, VS, ox, oy);

    // cristalli: nucleo sotto il buio, alone sopra
    const pels = game.L.pelList;
    g.fillStyle = `hsl(${hp},100%,80%)`;
    for (const p of pels) if (p.alive && !p.big) { g.beginPath(); g.arc(p.x, p.y, pr, 0, 6.283); g.fill(); }
    this.drawLight(game, h);
    g.save(); g.setTransform(1, 0, 0, 1, ox, oy); g.drawImage(this.lightCv, 0, 0, cv.width * vs, cv.height * vs); g.restore();
    g.globalCompositeOperation = 'lighter';
    for (const p of pels) if (p.alive) {
      if (p.big) glow(g, this.GICE, p.x, p.y, 44 + 6 * Math.sin(t * 3 + p.ph), .9);
      else glow(g, this.GP, p.x, p.y, 11 * pk, .34 + .2 * Math.sin(t * 3 + p.ph));
    }
    g.globalCompositeOperation = 'source-over';
    // pallini grossi: sfera color ghiaccio con anello che ruota (rallentano i mostri)
    for (const p of pels) if (p.alive && p.big) {
      const pr = 8 + .9 * Math.sin(t * 4 + p.ph), a = t * 2.2 + p.ph;
      const og = g.createRadialGradient(p.x - 2.5, p.y - 3, 1, p.x, p.y, pr);
      og.addColorStop(0, '#ffffff'); og.addColorStop(.5, 'hsl(195,100%,78%)'); og.addColorStop(1, 'hsl(205,90%,48%)');
      g.fillStyle = og; g.beginPath(); g.arc(p.x, p.y, pr, 0, 6.283); g.fill();
      g.strokeStyle = 'rgba(210,245,255,.9)'; g.lineWidth = 1.8; g.lineCap = 'round';
      g.beginPath(); g.arc(p.x, p.y, 12.5, a, a + 1.9); g.stroke();
      g.beginPath(); g.arc(p.x, p.y, 12.5, a + Math.PI, a + Math.PI + 1.9); g.stroke();
    }
    if (game.power) this.drawPower(g, game.power, t);

    this.drawRig(g, game, t);

    // tubo
    const pts = game.pipePoints(), hurt = game.phase === 'hit', shield = game.fx.scudo > 0;
    if (pts.length > 1) {
      const path = new Path2D(); path.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.globalCompositeOperation = 'lighter';
      if (shield) { g.strokeStyle = `hsla(48,100%,60%,${.22 + .12 * Math.sin(t * 10)})`; g.lineWidth = 30; g.stroke(path); }
      g.strokeStyle = hurt ? 'rgba(255,50,50,.3)' : 'rgba(255,130,40,.17)'; g.lineWidth = 22; g.stroke(path);
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = '#2a1608'; g.lineWidth = 10; g.stroke(path);
      const turbo = game.fx.turbo > 0;       // con il Turbo il flusso nel tubo corre e diventa verde
      g.strokeStyle = hurt ? '#ff5a4a' : shield ? '#ffd65a' : '#ff9d3c'; g.lineWidth = 6; g.stroke(path);
      g.strokeStyle = turbo ? 'rgba(170,255,120,.95)' : 'rgba(255,244,210,.92)'; g.lineWidth = turbo ? 2.6 : 2;
      g.setLineDash(turbo ? [9, 9] : [5, 13]); g.lineDashOffset = t * (turbo ? 190 : 70); g.stroke(path); g.setLineDash([]);
    }

    const frozen = game.fx.gelo > 0;
    for (const c of game.creatures) {
      this.drawCreature(g, c, t, frozen);
      if (c.x < -8 || c.x > W + 8) {          // avviso: mostro in arrivo da questo lato
        const ex = c.dir > 0 ? 18 : W - 18, a = .35 + .65 * Math.abs(Math.sin(t * 8 + c.ph)), hue = KINDS[c.kind].hue;
        g.strokeStyle = `hsla(${hue},100%,72%,${a})`; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(ex - 5 * c.dir, c.y - 8); g.lineTo(ex + 4 * c.dir, c.y); g.lineTo(ex - 5 * c.dir, c.y + 8); g.stroke();
        g.globalCompositeOperation = 'lighter'; glow(g, this.GC[c.kind], ex, c.y, 26, a * .7); g.globalCompositeOperation = 'source-over';
      }
    }
    this.drawHead(g, game, h, t);
    if (game.blocked) {                       // strada chiusa dal proprio tubo
      const b = game.blocked, a = Math.min(1, b.t / .25), s = 7;
      g.strokeStyle = `rgba(255,70,60,${a})`; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(b.x - s, b.y - s); g.lineTo(b.x + s, b.y + s); g.moveTo(b.x + s, b.y - s); g.lineTo(b.x - s, b.y + s); g.stroke();
      g.globalCompositeOperation = 'lighter'; glow(g, this.GR, b.x, b.y, 26, a * .6); g.globalCompositeOperation = 'source-over';
    }

    g.globalCompositeOperation = 'lighter';
    for (const p of game.parts) { g.fillStyle = `hsla(${p.h},100%,${p.l}%,${Math.min(1, p.life / p.max * 1.4)})`; g.beginPath(); g.arc(p.x, p.y, p.size, 0, 6.283); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    for (const p of game.pops) {
      g.globalAlpha = Math.min(1, p.life * 2.2);
      g.font = `700 17px ${FONT}`; g.letterSpacing = '1px'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(4,4,14,.85)'; g.strokeText(p.text, p.x, p.y);
      g.fillStyle = `hsl(${p.h},100%,80%)`; g.fillText(p.text, p.x, p.y);
    }
    g.globalAlpha = 1;

    // sovrapposizioni fisse rispetto al riquadro (senza tremolio)
    g.setTransform(VS, 0, 0, VS, vx * S, vy * S);
    if (game.flash > 0) { g.fillStyle = `rgba(255,40,40,${game.flash * .28})`; g.fillRect(0, 0, W, H); }
    if (frozen) { g.fillStyle = `rgba(120,200,255,${.05 + .02 * Math.sin(t * 5)})`; g.fillRect(0, GROUND, W, H - GROUND); }
    const gr = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * .95);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (opt.hud) this.drawHud(g, game, opt.hi || 0);
    if (opt.hud || opt.phase) this.drawPhase(g, game);
    g.restore();
    // chi disegna dopo (menu, comandi a tocco) trova lo schermo intero in coordinate di gioco
    g.setTransform(S, 0, 0, S, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.textAlign = 'left'; g.letterSpacing = '0px';
  }

  // ------------------------------------------------------------ barra di stato
  drawHud(g, game, hi) {
    const hp = game.prm.pal.pel;
    const gr = g.createLinearGradient(0, 0, 0, 58);
    gr.addColorStop(0, 'rgba(4,4,14,.9)'); gr.addColorStop(.7, 'rgba(4,4,14,.55)'); gr.addColorStop(1, 'rgba(4,4,14,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, 58);
    const lab = `600 11px ${FONT}`, val = `700 22px ${FONT}`, dim = 'rgba(200,205,255,.55)', white = '#f2f4ff';

    g.save(); g.shadowColor = '#ff8a2e'; g.shadowBlur = 14;
    g.fillStyle = '#ffb060'; g.beginPath(); g.moveTo(24, 14); g.lineTo(42, 14); g.lineTo(33, 36); g.closePath(); g.fill();
    txt(g, 'TRIVELLA', 54, 34, `700 24px ${FONT}`, '#ffb060', 7);
    g.restore();

    txt(g, 'PUNTI', 290, 16, lab, dim, 3); txt(g, String(game.score).padStart(6, '0'), 290, 39, val, white, 2);
    txt(g, 'RECORD', 430, 16, lab, dim, 3); txt(g, String(Math.max(hi, game.score)).padStart(6, '0'), 430, 39, val, 'rgba(242,244,255,.6)', 2);
    txt(g, 'SETTORE', 570, 16, lab, dim, 3);
    if (game.bonusStage) txt(g, 'BONUS', 570, 39, `700 20px ${FONT}`, `hsl(${hp},100%,72%)`, 2);
    else txt(g, String(game.level).padStart(2, '0'), 570, 39, val, white, 2);
    const m = game.mult();
    txt(g, 'BONUS', 670, 16, lab, dim, 3); txt(g, '×' + m, 670, 39, val, m > 1 ? `hsl(${hp},100%,72%)` : 'rgba(242,244,255,.45)', 2);

    txt(g, 'ENERGIA', 770, 16, lab, dim, 3);
    const segs = 22, lit = Math.ceil(game.energy * segs), low = game.energy < .25, blink = low && Math.sin(game.time * 12) > 0;
    for (let i = 0; i < segs; i++) {
      g.fillStyle = i < lit ? (low ? (blink ? '#ffb0a0' : '#ff5a4a') : `hsl(${hp},100%,${62 + 14 * (i / segs)}%)`) : 'rgba(200,205,255,.14)';
      g.fillRect(770 + i * 10, 26, 7, 12);
    }
    txt(g, 'SONDE', 1056, 16, lab, dim, 3);
    for (let i = 0; i < Math.max(3, Math.min(MAX_LIVES, game.lives)); i++) {
      const x = 1064 + i * 30, on = i < game.lives;
      g.fillStyle = on ? '#ff9d3c' : 'rgba(200,205,255,.16)';
      g.beginPath(); g.roundRect(x - 8, 24, 13, 14, 4); g.fill();
      g.beginPath(); g.moveTo(x + 6, 24); g.lineTo(x + 15, 31); g.lineTo(x + 6, 38); g.closePath();
      g.fillStyle = on ? '#dfe3ff' : 'rgba(200,205,255,.16)'; g.fill();
    }
    // mostri mangiati verso la prossima sonda
    g.fillStyle = 'rgba(200,205,255,.16)'; g.fillRect(1056, 44, 100, 3);
    g.fillStyle = '#ff9d3c'; g.fillRect(1056, 44, 100 * (game.eaten % MONSTERS_PER_LIFE) / MONSTERS_PER_LIFE, 3);

    // potenziamenti attivi
    let x = 24;
    POWERS.forEach((def, i) => {
      const left = game.fx[def.id];
      if (left <= 0) return;
      const col = `hsl(${def.hue},100%,74%)`;
      g.fillStyle = 'rgba(6,6,20,.72)'; g.beginPath(); g.roundRect(x, H - 40, 168, 26, 13); g.fill();
      g.save(); g.translate(x + 16, H - 27); this.powerIcon(g, i, 6, col); g.restore();
      txt(g, def.label, x + 32, H - 23, `700 12px ${FONT}`, col, 2);
      g.fillStyle = 'rgba(200,205,255,.16)'; g.fillRect(x + 108, H - 30, 48, 5);
      g.fillStyle = col; g.fillRect(x + 108, H - 30, 48 * Math.min(1, left / def.time), 5);
      x += 180;
    });
  }

  banner(g, big, small, a, hue, size) {
    if (a <= 0) return;
    g.globalAlpha = a;
    const gr = g.createLinearGradient(0, 300, 0, 500);
    gr.addColorStop(0, 'rgba(3,3,12,0)'); gr.addColorStop(.3, 'rgba(3,3,12,.78)'); gr.addColorStop(.7, 'rgba(3,3,12,.78)'); gr.addColorStop(1, 'rgba(3,3,12,0)');
    g.fillStyle = gr; g.fillRect(0, 300, W, 200);
    g.save(); g.shadowColor = '#ff7a1e'; g.shadowBlur = 40;
    txt(g, big, W / 2 + 8, 418, `700 ${size || 72}px ${FONT}`, '#ffb868', 16, 'center');
    g.restore();
    if (small) txt(g, small, W / 2 + 4, 456, `600 16px ${FONT}`, `hsl(${hue},100%,76%)`, 8, 'center');
    g.globalAlpha = 1;
  }
  drawPhase(g, game) {
    const hp = game.prm.pal.pel, lv = String(game.level).padStart(2, '0'), L = game.L;
    const fade = Math.min(1, (3.4 - game.phaseT) / .4, game.phaseT / .5);
    if (game.bonusStage && game.phase === 'ready') this.banner(g, 'SETTORE BONUS', 'NIENTE MOSTRI: RACCOGLI TUTTO PRIMA CHE FINISCA L\'ENERGIA', Math.min(1, game.phaseT / .4), hp);
    else if (game.bonusStage && game.phase === 'clear')
      this.banner(g, game.bonus ? 'PERFETTO!' : 'TEMPO SCADUTO', game.bonus ? 'TUTTI I CRISTALLI   BONUS +' + game.bonus : `CRISTALLI RACCOLTI  ${L.total - L.alive} SU ${L.total}`, fade, hp);
    else if (game.phase === 'ready') this.banner(g, 'SETTORE ' + lv, game.L.name, Math.min(1, game.phaseT / .4), hp);
    else if (game.phase === 'clear') this.banner(g, 'SETTORE ' + lv, 'COMPLETATO   BONUS +' + game.bonus, fade, hp);
    else if (game.phase === 'hit' && game.msg) this.banner(g, game.msg, game.lives > 0 ? 'SONDE RIMASTE  ' + game.lives : '', 1, 0, 52);
    else if (game.phase === 'over') this.banner(g, 'FINE PARTITA', '', 1, 0);
  }
}
