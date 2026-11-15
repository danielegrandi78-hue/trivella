// Logica di gioco: sonda, tubo, mostri, cristalli, potenziamenti, punteggio.
// Non disegna nulla e non suona nulla: segnala gli eventi con emit(nome).
// Nota: ENTRY non è fisso, cambia a ogni settore (vedi setEntry in config.js).
import { W, NX, NY, SP, Y0, N, RIG, ENTRY, EXTEND, RETRACT, HIT_RETRACT, MAX_LIVES, EXTRA_LIFE_EVERY, MONSTERS_PER_LIFE, TURBO_EXTEND, TURBO_RETRACT, KINDS, POWERS, nodes, P, D, ek, rowOf } from './config.js';
import { generateLevel, TYPES } from './level.js';

const TURN_GRACE = 34;     // px oltre l'incrocio entro cui una svolta premuta in ritardo viene ancora presa

export class Game {
  constructor(emit) {
    this.emit = emit || (() => { });
    this.time = 0; this.bgKey = 0;
    this.newGame(true);
  }

  // attract = demo automatica dietro il menu.
  // opts (sfida online): { seed, types } fissano la stessa sequenza di settori per entrambi i giocatori.
  newGame(attract, opts) {
    this.attract = !!attract;
    this.score = 0; this.lives = 3; this.nextLife = EXTRA_LIFE_EVERY; this.eaten = 0;
    this.parts = []; this.pops = []; this.gifts = [];
    this.seed = opts && opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0;      // ogni partita ha settori diversi
    this.fixedTypes = opts && opts.types ? opts.types : null;
    this.typeQueue = []; this.lastType = -1;
    this.startLevel(1);
  }

  // Pesca il tipo di schermo: li passa tutti in ordine casuale prima di ripeterne uno.
  nextType() {
    if (this.fixedTypes) return this.fixedTypes[(this.level - 1) % this.fixedTypes.length];
    if (!this.typeQueue.length) {
      const q = TYPES.map((_, i) => i);
      for (let i = q.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[q[i], q[j]] = [q[j], q[i]]; }
      if (q[q.length - 1] === this.lastType) q.reverse();
      this.typeQueue = q;
    }
    return this.lastType = this.typeQueue.pop();
  }

  startLevel(lv, forceType) {
    this.level = lv;
    this.L = generateLevel(lv, this.seed, forceType != null ? forceType : this.nextType());
    this.prm = this.L.prm;
    this.pipe = [RIG]; this.inPipe = new Uint8Array(N + 1); this.inPipe[RIG] = 1;
    this.target = null; this.prog = 0;
    this.mode = 'extend'; this.heading = { x: 0, y: 1 };
    this.backtrack = false; this.hitRetract = false; this.threatened = false; this.holdT = 0;
    this.energy = 1; this.creatures = []; this.spawnT = 1;
    this.power = null; this.powerT = 9 + Math.random() * 6; this.fx = { gelo: 0, scudo: 0, calamita: 0, turbo: 0 };
    this.phase = 'ready'; this.phaseT = this.attract ? .4 : 1.9; this.msg = ''; this.bonus = 0;
    this.headAng = Math.PI / 2; this.reel = 0; this.shake = 0; this.flash = 0; this.motion = 0;
    this.blocked = null; this.blockedAt = -9; this.snapKey = '';
    for (let i = 0; i < 3; i++) this.spawnCreature(true);
    this.bgKey++;
    this.emit('ready');
  }

  // ------------------------------------------------------------ geometria del tubo
  headPos() {
    const a = P(this.pipe[this.pipe.length - 1]);
    if (this.target == null) return { x: a.x, y: a.y };
    const b = P(this.target);
    return { x: a.x + (b.x - a.x) * this.prog, y: a.y + (b.y - a.y) * this.prog };
  }
  pipePoints() {
    const pts = this.pipe.map(P);
    if (this.target != null && this.prog > 0) pts.push(this.headPos());
    return pts;
  }
  nearestOnPipe(x, y) {
    const pts = this.pipePoints(); let best = 1e9, bs = 0, acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, len = Math.sqrt(l2);
      let t = l2 ? ((x - a.x) * vx + (y - a.y) * vy) / l2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - a.x - vx * t, y - a.y - vy * t);
      if (d < best) { best = d; bs = acc + len * t; }
      acc += len;
    }
    return { d: best, s: bs, L: acc };
  }
  pipeLen() { return (this.pipe.length - 1) * SP + (this.target != null ? this.prog * SP : 0); }
  // Più tubo è fuori, più si rischia e più valgono i punti.
  mult() { return Math.min(5, 1 + Math.floor(this.pipeLen() / 640)); }

  // ------------------------------------------------------------ effetti e punteggio
  burst(x, y, n, h, sp, life, light) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = sp * (.25 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (.5 + Math.random() * .5), max: life, h, l: light || 68, size: 1.4 + Math.random() * 2.4 });
    }
    if (this.parts.length > 700) this.parts.splice(0, this.parts.length - 700);
  }
  pop(x, y, text, h) { this.pops.push({ x, y, text, life: 1.1, h }); }
  gainLife() {
    if (this.attract || this.lives >= MAX_LIVES) return;
    this.lives++; this.emit('life');
    const h = this.headPos(); this.pop(h.x, h.y - 30, 'SONDA EXTRA', 48);
  }
  addScore(pts) {
    this.score += pts;
    while (!this.attract && this.score >= this.nextLife) { this.nextLife += EXTRA_LIFE_EVERY; this.gainLife(); }
  }
  // Mostro mangiato con la bocca: ogni MONSTERS_PER_LIFE si guadagna una sonda.
  countEaten() { if (!this.attract && ++this.eaten % MONSTERS_PER_LIFE === 0) this.gainLife(); }
  loseLife(msg) {
    if (this.phase !== 'play') return;
    this.lives--; this.phase = 'hit'; this.phaseT = .9; this.msg = msg;
    this.shake = 16; this.flash = 1;
    this.fx.gelo = this.fx.scudo = this.fx.calamita = this.fx.turbo = 0;
    // i cristalli in volo verso la bocca tornano al loro posto
    for (const p of this.L.pelList) if (p.pulled && p.alive) { p.x = p.hx; p.y = p.hy; p.pulled = false; }
    this.emit('hit');
  }

  // ------------------------------------------------------------ movimento della sonda
  neighborInDir(id, d) {
    if (id === RIG) return d.y === 1 ? ENTRY : null;
    if (id === ENTRY && d.y === -1) return RIG;
    const i = id % NX + d.x, j = rowOf(id) + d.y;
    if (i < 0 || i >= NX || j < 0 || j >= NY) return null;
    const v = j * NX + i;
    return this.L.adj[id].includes(v) ? v : null;
  }
  stepProbe(dt, manual) {
    const turbo = this.fx.turbo > 0;
    let move = (this.mode === 'retract' ? (this.hitRetract ? HIT_RETRACT : RETRACT * (turbo ? TURBO_RETRACT : 1)) : EXTEND * (turbo ? TURBO_EXTEND : 1)) * dt, guard = 0;
    while (move > 1e-4 && guard++ < 60) {
      const top = this.pipe[this.pipe.length - 1];
      if (this.mode === 'extend') {
        if (this.target == null) {
          if (manual) break;
          this.chooseTarget();
          if (this.target == null && this.mode === 'extend') break;
          continue;
        }
        const a = P(top), b = P(this.target);
        this.heading = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
        const len = D(top, this.target), rem = (1 - this.prog) * len;
        if (move >= rem) {
          move -= rem; this.reel += rem;
          this.pipe.push(this.target); this.inPipe[this.target] = 1; this.target = null; this.prog = 0;
        } else { this.prog += move / len; this.reel += move; move = 0; }
      } else {
        if (this.target == null) {
          if (this.pipe.length <= 1) { this.hitRetract = false; this.backtrack = false; this.mode = 'extend'; break; }
          this.target = this.pipe.pop(); this.inPipe[this.target] = 0; this.prog = 1;
        }
        const top2 = this.pipe[this.pipe.length - 1], a = P(top2), b = P(this.target);
        this.heading = { x: Math.sign(a.x - b.x), y: Math.sign(a.y - b.y) };
        const len = D(top2, this.target), rem = this.prog * len;
        if (move >= rem) {
          move -= rem; this.reel -= rem; this.target = null; this.prog = 0;
          if (this.hitRetract) continue;
          if (manual) break;
          if (this.threat(this.threatened ? 1 : .35)) { this.threatened = true; continue; }
          this.backtrack = false; this.mode = 'extend';
        } else { this.prog -= move / len; this.reel -= move; move = 0; }
      }
    }
  }
  // Ritira tutto il tubo (dopo un colpo o a fine settore). Vero quando è rientrato.
  reelIn(dt) {
    if (this.pipe.length <= 1 && this.target == null) return true;
    this.hitRetract = true; this.mode = 'retract'; this.stepProbe(dt, false);
    return false;
  }

  // Comandi del giocatore. Le direzioni fanno solo avanzare: il tubo si ritira soltanto con il
  // tasto di ritiro. Una direzione tenuta premuta che non è ancora percorribile fa proseguire
  // la sonda dritta finché la svolta diventa possibile.
  canGo(top, d) { const nb = this.neighborInDir(top, d); return nb != null && !this.inPipe[nb]; }
  tryDir(top, d) {
    if (!this.canGo(top, d)) return false;
    this.target = this.neighborInDir(top, d); this.prog = 0; this.mode = 'extend';
    return true;
  }
  // La svolta richiesta esiste ma è occupata dal proprio tubo: lo segnala (croce rossa e suono).
  noteBlocked(top, d) {
    const nb = this.neighborInDir(top, d), n = this.pipe.length;
    if (nb == null || !this.inPipe[nb] || (n >= 2 && nb === this.pipe[n - 2]) || this.time - this.blockedAt < .5) return;
    const a = P(top), b = P(nb);
    this.blockedAt = this.time; this.blocked = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, t: .45 };
    this.emit('blocked');
  }
  // inp.dirs = direzioni tenute premute, la più recente per prima (anche due insieme).
  // Regole: la svolta ha la precedenza sul proseguire dritto; premuta in anticipo viene presa
  // al primo incrocio utile, premuta un attimo in ritardo fa tornare all'incrocio appena passato.
  manualStep(dt, inp) {
    this.backtrack = false;
    if (inp && inp.retract) { this.mode = 'retract'; this.stepProbe(dt, true); return; }
    const dirs = inp && inp.dirs;
    if (!dirs || !dirs.length) return;
    const n = this.pipe.length, top = this.pipe[n - 1];
    if (this.target != null) {                   // a metà di un tratto
      const a = P(top), b = P(this.target), ex = Math.sign(b.x - a.x), ey = Math.sign(b.y - a.y);
      const turn = dirs.find(d => d.x * ex + d.y * ey === 0);
      // svolta in ritardo: vale solo se l'incrocio è stato attraversato dritto (non se lì si è appena svoltato)
      const prev = n >= 2 ? P(this.pipe[n - 2]) : null;
      const straight = prev && Math.sign(a.x - prev.x) === ex && Math.sign(a.y - prev.y) === ey;
      if (turn && straight && this.prog * SP <= TURN_GRACE && this.canGo(top, turn)) { this.mode = 'retract'; this.stepProbe(dt, true); return; }
      if (!turn && !dirs.some(d => d.x === ex && d.y === ey)) return;      // solo "indietro": resta ferma
      this.mode = 'extend';
    } else {                                     // su un incrocio
      const a = n >= 2 ? P(this.pipe[n - 2]) : { x: P(top).x, y: P(top).y - 1 }, b = P(top);
      const fwd = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };       // verso in cui il tubo arriva alla bocca
      const turn = dirs.find(d => d.x * fwd.x + d.y * fwd.y === 0);
      const ahead = dirs.some(d => d.x === fwd.x && d.y === fwd.y);
      if (!(turn && this.tryDir(top, turn))) {
        if (turn) this.noteBlocked(top, turn);
        if (!(ahead || turn) || !this.tryDir(top, fwd)) return;
      }
    }
    this.stepProbe(dt, true);
  }

  // ------------------------------------------------------------ pilota automatico (demo)
  bfsNext(start) {
    const { adj, nodePel, edgePel } = this.L;
    const prev = new Int16Array(N).fill(-1), seen = new Uint8Array(N), q = [start]; seen[start] = 1;
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi];
      for (const v of adj[u]) {
        if (seen[v] || this.inPipe[v]) continue;
        seen[v] = 1; prev[v] = u;
        if (nodePel[v].alive || edgePel.get(ek(u, v)).alive) { let w = v; while (prev[w] !== start) w = prev[w]; return w; }
        q.push(v);
      }
    }
    return null;
  }
  chooseTarget() {
    const u = this.pipe[this.pipe.length - 1];
    if (this.L.alive <= 0) return;
    if (u === RIG) { this.target = ENTRY; this.prog = 0; return; }
    for (const c of this.creatures) {          // va incontro ai mostri in arrivo nella stessa corsia
      if (c.row !== rowOf(u) || KINDS[c.kind].armored) continue;
      const dx = (nodes[u].x - c.x) * c.dir, nb = u - c.dir;
      if (dx > 0 && dx < 170 && nb >= 0 && nb < N && rowOf(nb) === c.row && !this.inPipe[nb]) { this.target = nb; this.prog = 0; return; }
    }
    const v = this.bfsNext(u);
    if (v != null) { this.target = v; this.prog = 0; } else { this.mode = 'retract'; this.backtrack = true; }
  }
  // Un mostro è una minaccia se, proseguendo nella corsia, tocca il tubo prima che la bocca
  // riesca a ritirarsi oltre quel punto. Se il primo contatto è la bocca, viene mangiato.
  threat(margin) {
    const h = this.headPos(), ext = this.target != null ? this.prog * SP : 0;
    for (const c of this.creatures) {
      let best = 1e9, need = 0;
      if (Math.abs(h.y - c.y) < 14) { const dx = (h.x - c.x) * c.dir; if (dx > -14) { best = dx; need = KINDS[c.kind].armored ? 1 : 0; } }
      for (let k = 1; k < this.pipe.length; k++) {
        const id = this.pipe[k];
        if (rowOf(id) !== c.row) continue;
        const dx = (nodes[id].x - c.x) * c.dir;
        if (dx > -14 && dx < best) { best = dx; need = ((this.pipe.length - 1 - k) * SP + ext) / RETRACT; }
      }
      if (need > .05 && Math.max(0, best - 13) / c.speed < need + margin) return true;
    }
    return false;
  }
  autoStep(dt) {
    if (this.threat(this.threatened ? 1 : .35)) { this.threatened = true; this.mode = 'retract'; this.holdT = .2; }
    else if (this.holdT > 0) this.holdT -= dt;
    else { this.threatened = false; if (this.mode === 'retract' && !this.backtrack) this.mode = 'extend'; }
    this.stepProbe(dt, false);
  }

  // ------------------------------------------------------------ mostri
  // Entrano da un lato, percorrono la loro corsia ed escono dall'altro.
  // gift = tipo di mostro mandato dall'avversario (sfida online): entra comunque, un po' più veloce.
  spawnCreature(onScreen, gift) {
    const prm = this.prm, lv = this.level, forced = gift != null;
    let kind = forced ? gift : 3;
    if (!forced && Math.random() >= prm.armored) {
      const w = [3, 2 + lv * .3, .5 + lv * .5]; let x = Math.random() * (w[0] + w[1] + w[2]);
      kind = x < w[0] ? 0 : x < w[0] + w[1] ? 1 : 2;
    }
    for (let tries = 0; tries < 8; tries++) {
      const dir = Math.random() < .5 ? 1 : -1;
      // solo nelle corsie aperte ai lati; all'inizio del settore non nella corsia d'ingresso
      const lanes = this.L.lanes, pool = onScreen && lanes.length > 1 ? lanes.filter(j => j > 0) : lanes;
      const row = pool[(Math.random() * pool.length) | 0];
      // non entra in una corsia dove il tubo è a ridosso del bordo d'ingresso: sarebbe inevitabile
      let fair = true;
      for (let k = 1; k < this.pipe.length && fair; k++) {
        const id = this.pipe[k];
        if (rowOf(id) === row && (dir > 0 ? nodes[id].x : W - nodes[id].x) < 270) fair = false;
      }
      if (!fair && !onScreen && !(forced && tries === 7)) continue;
      const x = onScreen ? 80 + Math.random() * (W - 160) : (dir > 0 ? -200 : W + 200);
      this.creatures.push({ kind, row, dir, x, y: Y0 + row * SP, speed: KINDS[kind].speed * prm.speedMul * (forced ? 1.15 : 1) * (.92 + Math.random() * .16), age: onScreen ? 0 : 1, ph: Math.random() * 6.28 });
      if (!onScreen) this.emit('warn');
      return;
    }
  }
  killCreature(i, pts) {
    const c = this.creatures[i], k = KINDS[c.kind];
    this.burst(c.x, c.y, 30, k.hue, 210, .7); this.shake = Math.max(this.shake, 5);
    if (pts) { const v = pts * this.mult(); this.addScore(v); this.pop(c.x, c.y - 14, '+' + v, k.hue); }
    this.creatures.splice(i, 1);
  }
  updateCreatures(dt, collide) {
    const slow = this.fx.gelo > 0 ? .25 : 1, h = this.headPos();
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i], k = KINDS[c.kind];
      c.age += dt; c.x += c.speed * slow * c.dir * dt;
      if ((c.dir > 0 && c.x > W + 60) || (c.dir < 0 && c.x < -60)) { this.creatures.splice(i, 1); continue; }
      if (!collide || this.phase !== 'play' || c.age < .4) continue;
      const shield = this.fx.scudo > 0;
      if (Math.hypot(c.x - h.x, c.y - h.y) < 20) {          // la bocca
        if (k.armored && !shield) {
          this.burst(c.x, c.y, 46, 12, 260, .9); this.creatures.splice(i, 1);
          this.loseLife('SONDA DISTRUTTA');
        } else { this.killCreature(i, k.pts); this.countEaten(); this.emit('eat', c.kind); }
        continue;
      }
      const n = this.nearestOnPipe(c.x, c.y);
      if (n.L - n.s > 24 && n.d < 13) {                       // il tubo
        if (shield) { this.killCreature(i, k.pts); this.emit('zap'); }
        else {
          this.burst(c.x, c.y, 46, 12, 260, .9); this.burst(c.x, c.y, 20, k.hue, 160, .7);
          this.creatures.splice(i, 1);
          this.loseLife('TUBO SPEZZATO');
        }
      }
    }
  }

  // ------------------------------------------------------------ cristalli e potenziamenti
  collect(dt) {
    const h = this.headPos(), L = this.L, hue = this.prm.pal.pel, mag = this.fx.calamita > 0;
    for (const p of L.pelList) {
      if (!p.alive) continue;
      const dx = h.x - p.x, dy = h.y - p.y;
      if (!p.pulled && (Math.abs(dx) > 130 || Math.abs(dy) > 130)) continue;
      let d = Math.hypot(dx, dy);
      // Calamita: un cristallo agganciato vola fino alla bocca anche se l'effetto finisce nel
      // frattempo, così non resta mai fermo a metà strada dentro la roccia.
      if (!p.pulled && mag && d < 125) { p.pulled = true; p.hx = p.x; p.hy = p.y; }
      if (p.pulled && d > 1) { const v = Math.min(d, (mag ? 460 : 720) * dt); p.x += dx / d * v; p.y += dy / d * v; d -= v; }
      if (d > 11) continue;
      p.alive = false; L.alive--;
      if (p.big) {
        // pallino grosso: punti, energia e mostri rallentati per qualche secondo
        const pts = 500 * this.mult(); this.addScore(pts); this.energy = Math.min(1, this.energy + .3);
        this.fx.gelo = POWERS[0].time;
        this.burst(p.x, p.y, 40, POWERS[0].hue, 210, .8, 80); this.shake = Math.max(this.shake, 5);
        this.pop(p.x, p.y - 16, '+' + pts + '  LENTI', POWERS[0].hue); this.emit('crystal');
      } else {
        this.addScore(10 * this.mult()); this.burst(p.x, p.y, 4, hue, 70, .35, 78); this.emit('pellet');
      }
    }
    if (L.alive <= 0 && this.phase === 'play') {
      this.phase = 'clear'; this.phaseT = 3.4;
      this.bonus = 1000 + Math.round(this.energy * 200) * 10; this.addScore(this.bonus);
      this.emit('clear');
    }
  }
  updatePower(dt) {
    for (const k in this.fx) if (this.fx[k] > 0) this.fx[k] = Math.max(0, this.fx[k] - dt);
    const h = this.headPos();
    if (this.power) {
      const p = this.power; p.life -= dt;
      if (Math.hypot(p.x - h.x, p.y - h.y) < 17) {
        const def = POWERS[p.kind];
        this.fx[def.id] = def.time; this.burst(p.x, p.y, 30, def.hue, 200, .8, 75);
        this.pop(p.x, p.y - 18, def.label, def.hue); this.emit('power'); this.power = null;
      } else if (p.life <= 0) this.power = null;
      return;
    }
    this.powerT -= dt;
    if (this.powerT > 0) return;
    this.powerT = 13 + Math.random() * 9;
    for (let tries = 0; tries < 14; tries++) {
      const ex = this.L.exist, id = ex[(Math.random() * ex.length) | 0], n = nodes[id];
      if (this.inPipe[id] || Math.hypot(n.x - h.x, n.y - h.y) < 200) continue;
      const kinds = []; POWERS.forEach((p, i) => { if (p.pickup !== false) kinds.push(i); });
      this.power = { kind: kinds[(Math.random() * kinds.length) | 0], x: n.x, y: n.y, life: 10, ph: Math.random() * 6.28 };
      break;
    }
  }

  // ------------------------------------------------------------ sfida online
  // Dispetto: un mostro mangiato dall'avversario entra poco dopo in questa mappa.
  queueGift(kind) { if (this.gifts.length < 6 && KINDS[kind]) this.gifts.push({ kind, t: 1 + this.gifts.length * .6 }); }

  // Stato dei cristalli in forma compatta: 6 cristalli per carattere.
  pelMask() {
    const pl = this.L.pelList; let out = '';
    for (let i = 0; i < pl.length; i += 6) { let v = 0; for (let b = 0; b < 6 && i + b < pl.length; b++) if (pl[i + b].alive) v |= 1 << b; out += String.fromCharCode(48 + v); }
    return out;
  }
  setPelMask(m) {
    const pl = this.L.pelList; let n = 0;
    for (let i = 0; i < pl.length; i++) { const a = ((m.charCodeAt((i / 6) | 0) - 48) >> (i % 6)) & 1; pl[i].alive = !!a; n += a; }
    this.L.alive = n;
  }
  // Fotografia della partita da mandare all'avversario, che la mostra nella sua metà di schermo.
  snap() {
    const L = this.L, key = this.level + ':' + L.alive, r1 = v => Math.round(v * 10) / 10;
    const s = {
      t: 's', sd: this.seed, lv: this.level, ty: L.type,
      pi: this.pipe.slice(1), tg: this.target, pg: Math.round(this.prog * 1000) / 1000, mo: this.motion, ha: Math.round(this.headAng * 100) / 100,
      cr: this.creatures.map(c => [c.kind, c.row, c.dir, Math.round(c.x), Math.round(c.speed)]),
      pw: this.power ? [this.power.kind, this.power.x, this.power.y, r1(this.power.life)] : 0,
      fx: [r1(this.fx.gelo), r1(this.fx.scudo), r1(this.fx.calamita), r1(this.fx.turbo)],
      sc: this.score, li: this.lives, ea: this.eaten, en: Math.round(this.energy * 100) / 100, ph: this.phase, pt: r1(this.phaseT), ms: this.msg, bo: this.bonus
    };
    if (key !== this.snapKey) { this.snapKey = key; s.pm = this.pelMask(); }      // i cristalli solo quando cambiano
    return s;
  }
  // Applica una fotografia ricevuta: questa partita diventa la copia di quella dell'avversario.
  applySnap(s) {
    if (!this.L || s.sd !== this.seed || s.lv !== this.level || s.ty !== this.L.type) {
      this.seed = s.sd; this.level = s.lv; this.L = generateLevel(s.lv, s.sd, s.ty); this.prm = this.L.prm;
      this.bgKey++; this.parts = []; this.pops = [];
    }
    if (s.pm) this.setPelMask(s.pm);
    this.pipe = [RIG].concat(s.pi); this.target = s.tg; this.prog = s.pg; this.motion = s.mo; this.headAng = s.ha;
    this.creatures = s.cr.map((c, i) => ({ kind: c[0], row: c[1], dir: c[2], x: c[3], y: Y0 + c[1] * SP, speed: c[4], age: 1, ph: i * 1.7 }));
    this.power = s.pw ? { kind: s.pw[0], x: s.pw[1], y: s.pw[2], life: s.pw[3], ph: 0 } : null;
    this.fx.gelo = s.fx[0]; this.fx.scudo = s.fx[1]; this.fx.calamita = s.fx[2]; this.fx.turbo = s.fx[3] || 0;
    if (s.ph === 'hit' && this.phase !== 'hit') { this.shake = 12; this.flash = 1; }
    this.score = s.sc; this.lives = s.li; this.eaten = s.ea | 0; this.energy = s.en; this.phase = s.ph; this.phaseT = s.pt; this.msg = s.ms; this.bonus = s.bo;
  }
  // Tra una fotografia e l'altra la copia prosegue da sola, così il movimento resta fluido.
  puppetTick(dt) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 42);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
    const slow = this.fx.gelo > 0 ? .25 : 1;
    for (const c of this.creatures) c.x += c.speed * slow * c.dir * dt;
    if (this.target != null) {
      if (this.motion > 0) { const d = Math.min(1 - this.prog, EXTEND * (this.fx.turbo > 0 ? TURBO_EXTEND : 1) * dt / SP); this.prog += d; this.reel += d * SP; }
      else if (this.motion < 0) { const d = Math.min(this.prog, RETRACT * dt / SP); this.prog -= d; this.reel -= d * SP; }
    }
    if (this.phaseT > 0) this.phaseT -= dt;
  }

  // ------------------------------------------------------------ ciclo principale
  update(dt, inp) {
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 42);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
    if (this.blocked && (this.blocked.t -= dt) <= 0) this.blocked = null;
    const before = this.headPos();

    switch (this.phase) {
      case 'ready':
        this.phaseT -= dt; if (this.phaseT <= 0) this.phase = 'play';
        break;
      case 'play':
        this.energy -= dt / this.prm.energyTime;
        if (this.attract) this.autoStep(dt); else this.manualStep(dt, inp);
        this.collect(dt);
        if (this.phase !== 'play') break;
        this.updatePower(dt);
        this.updateCreatures(dt, true);
        for (let i = this.gifts.length - 1; i >= 0; i--) if ((this.gifts[i].t -= dt) <= 0) { this.spawnCreature(false, this.gifts[i].kind); this.gifts.splice(i, 1); }
        this.spawnT -= dt;
        if (this.spawnT <= 0 && this.creatures.length < this.prm.maxCreatures) {
          this.spawnCreature(false);
          const [a, b] = this.prm.spawnGap; this.spawnT = a + Math.random() * (b - a);
        }
        if (this.energy <= 0 && this.phase === 'play') {
          if (this.attract) this.energy = 1;
          else { this.loseLife('ENERGIA ESAURITA'); this.energy = 1; }
        }
        break;
      case 'hit': {
        const done = this.reelIn(dt);
        this.updateCreatures(dt, false);
        if (!done) break;
        this.phaseT -= dt;
        if (this.phaseT > 0) break;
        if (this.lives <= 0) {
          if (this.attract) this.newGame(true);
          else { this.phase = 'over'; this.emit('over'); }
        } else { this.phase = 'play'; this.msg = ''; }
        break;
      }
      case 'clear':
        this.reelIn(dt); this.updateCreatures(dt, false);
        this.phaseT -= dt;
        if (this.phaseT <= 0) { this.startLevel(this.level + 1); return; }
        break;
      case 'over': break;
    }

    // orientamento della bocca, polvere di scavo, particelle
    const h = this.headPos();
    if (this.target != null) {
      const a = P(this.pipe[this.pipe.length - 1]), b = P(this.target), want = Math.atan2(b.y - a.y, b.x - a.x);
      let df = want - this.headAng; while (df > Math.PI) df -= 6.283; while (df < -Math.PI) df += 6.283;
      this.headAng += df * Math.min(1, dt * 22);
    }
    const moved = Math.hypot(h.x - before.x, h.y - before.y);
    this.motion = moved > .3 ? (this.mode === 'retract' ? -1 : 1) : 0;
    if (this.motion === 1 && Math.random() < .6) {
      const ca = Math.cos(this.headAng), sa = Math.sin(this.headAng);
      this.parts.push({ x: h.x + ca * 16, y: h.y + sa * 16, vx: -ca * 40 + (Math.random() - .5) * 90, vy: -sa * 40 + (Math.random() - .5) * 90, life: .35, max: .35, h: 30, l: 72, size: 1.2 + Math.random() * 1.4 });
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i]; p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 2.6 * dt; p.vy *= 1 - 2.6 * dt;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i]; p.life -= dt; p.y -= 26 * dt;
      if (p.life <= 0) this.pops.splice(i, 1);
    }
  }
}
