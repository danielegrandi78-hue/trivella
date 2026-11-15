// Generazione dei settori. Ogni settore nasce da un "tipo di schermo" con una struttura propria
// e da un seme casuale, così non ne escono mai due uguali.
//
// La mappa è una griglia NX x NY di incroci. Ogni riga può essere:
//   L = corsia: galleria che attraversa tutto lo schermo ed esce ai lati (ci passano i mostri)
//   P = tasche: tratti di galleria chiusi, senza mostri
//   N = roccia piena: la attraversano solo i pozzi verticali
import { NX, NY, N, PALETTES, nodes, ek, rng, setEntry } from './config.js';

export const TYPES = [
  { name: 'GALLERIE', rows: ['LLLLLLLL'], shafts: 'random' },
  { name: 'TASCHE', rows: ['LPLPLPLL', 'LLPLPLPL', 'LPLLPLPL'], shafts: 'random' },
  { name: 'CAVERNE', rows: ['LLPLLPLL', 'LPLLLPLL', 'LLLPLLPL'], shafts: 'random', rooms: [2, 3] },
  { name: 'SPECCHIO', rows: ['LPLLPLPL', 'LLPLPLLL', 'LPLPLLPL'], shafts: 'random', mirror: true },
  { name: 'SCALINATA', rows: ['LLLLLLLL', 'LLLNLLLL', 'LLLLNLLL'], shafts: 'stairs' },
  { name: 'POZZO MAESTRO', rows: ['LPPLPPLL', 'LPLPPLPL', 'LPPLPLLP'], shafts: 'trunk' },
  { name: 'ROCCIA DURA', rows: ['LNLNLLNL', 'LLNLNLNL', 'LNLLNLNL'], shafts: 'random' }
];

// Difficoltà crescente con il numero del settore.
export function levelParams(lv) {
  const k = lv - 1;
  return {
    lv,
    maxCreatures: Math.min(4 + Math.ceil(k / 2), 9),
    spawnGap: [Math.max(.45, 1.3 - k * .08), Math.max(1, 2.6 - k * .14)],
    speedMul: Math.min(1.75, 1 + k * .06),
    armored: lv >= 3 ? Math.min(.28, .1 + (lv - 3) * .03) : 0,
    energyTime: Math.max(75, 140 - k * 6),          // secondi per svuotare l'energia
    shafts: lv < 4 ? [4, 5] : lv < 8 ? [3, 5] : [3, 4]
  };
}

export function generateLevel(lv, seed, typeIdx) {
  const prm = levelParams(lv), r = rng((seed | 0) + lv * 7919 + typeIdx * 131);
  const int = n => (r() * n) | 0;
  const type = TYPES[typeIdx], rows = type.rows[int(type.rows.length)].split('');
  const mirror = !!type.mirror, style = type.shafts;
  const entry = (NX - 1) >> 1;          // la trivella parte sempre dal centro dello schermo
  setEntry(entry);
  prm.pal = PALETTES[((seed >>> 0) + lv) % PALETTES.length];

  const adj = Array.from({ length: N }, () => []);
  const id = (i, j) => j * NX + i;
  const link = (a, b) => { if (!adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); } };
  const hseg = (j, a, b) => { for (let i = a; i < b; i++) link(id(i, j), id(i + 1, j)); };

  // 1. gallerie orizzontali
  rows.forEach((t, j) => {
    if (t === 'L') { hseg(j, 0, NX - 1); return; }
    if (t !== 'P') return;
    const segs = [];
    if (style === 'trunk') {            // rami che partono dal pozzo maestro
      const a = Math.max(0, entry - 1 - int(5)), b = Math.min(NX - 1, entry + 1 + int(5));
      segs.push([a, b]);
      if (a >= 4) segs.push([int(2), a - 2]); else if (NX - 1 - b >= 4) segs.push([b + 2, NX - 1 - int(2)]);
    } else {
      const lim = mirror ? 9 : NX - 1;
      let pos = int(3);
      while (pos < lim - 1) { const b = Math.min(lim, pos + 1 + int(5)); segs.push([pos, b]); pos = b + 2 + int(3); }
    }
    for (const [a, b] of segs) { hseg(j, a, b); if (mirror) hseg(j, NX - 1 - b, NX - 1 - a); }
  });

  // 2. caverne: zone rettangolari tutte aperte
  const rooms = [];
  if (type.rooms) {
    const cnt = type.rooms[0] + int(type.rooms[1] - type.rooms[0] + 1);
    for (let guard = 0; rooms.length < cnt && guard < 80; guard++) {
      const w = 2 + int(3), h = 1 + int(2), c0 = 1 + int(NX - 2 - w), r0 = 1 + int(NY - 1 - h);
      const room = { c0, c1: c0 + w, r0, r1: r0 + h };
      if (rooms.some(o => !(room.c0 > o.c1 + 1 || room.c1 < o.c0 - 1 || room.r0 > o.r1 + 1 || room.r1 < o.r0 - 1))) continue;
      rooms.push(room);
      for (let j = room.r0; j <= room.r1; j++) hseg(j, room.c0, room.c1);
      for (let i = room.c0; i <= room.c1; i++) for (let j = room.r0; j < room.r1; j++) link(id(i, j), id(i, j + 1));
    }
  }

  // 3. pozzi verticali: da un incrocio esistente scendono fino al primo incrocio esistente più sotto
  const hcols = rows.map((_, j) => { const c = []; for (let i = 0; i < NX; i++) if (adj[id(i, j)].length) c.push(i); return c; });
  const drop = (i, j) => {
    for (let k = j + 1; k < NY && k <= j + 3; k++) if (adj[id(i, k)].length) { for (let q = j; q < k; q++) link(id(i, q), id(i, q + 1)); return true; }
    return false;
  };
  const b0 = int(NX), slope = r() < .5 ? 2 : -2;
  let prev = [entry];
  for (let j = 0; j < NY - 1; j++) {
    const cands = hcols[j];
    if (!cands.length) continue;
    const [lo, hi] = prm.shafts;
    const want = rows[j] === 'L' ? lo + int(hi - lo + 1) : Math.max(1, Math.round(cands.length / 5));
    const picked = [];
    const tryCol = c => {
      if (picked.includes(c) || !cands.includes(c) || !drop(c, j)) return;
      picked.push(c);
      const m = NX - 1 - c;
      if (mirror && m !== c && cands.includes(m) && drop(m, j)) picked.push(m);
    };
    if (style === 'trunk') tryCol(entry);
    if (style === 'stairs') for (let k = 0; k < 3; k++) tryCol((((b0 + slope * j + k * 6) % NX) + NX) % NX);
    for (let guard = 0; picked.length < want && guard < 220; guard++) {
      const c = cands[int(cands.length)];
      if (mirror && c > 9) continue;
      if (picked.some(x => Math.abs(x - c) < (guard < 130 ? 3 : 2)) || (guard < 90 && prev.includes(c))) continue;
      tryCol(c);
    }
    prev = picked;
  }

  // 4. tutto deve essere raggiungibile dall'ingresso: i tratti isolati vengono collegati verso l'alto
  const reach = () => {
    const seen = new Uint8Array(N), q = [entry]; seen[entry] = 1;
    for (let qi = 0; qi < q.length; qi++) for (const v of adj[q[qi]]) if (!seen[v]) { seen[v] = 1; q.push(v); }
    return seen;
  };
  for (let pass = 0; pass < 60; pass++) {
    const seen = reach(), lost = [];
    for (let u = 0; u < N; u++) if (adj[u].length && !seen[u]) lost.push(u);
    if (!lost.length) break;
    const u = lost[int(lost.length)], i = u % NX;
    for (let j = (u / NX) | 0; j > 0; j--) { link(id(i, j - 1), id(i, j)); if (seen[id(i, j - 1)]) break; }
  }

  // 5. cristalli su ogni incrocio e a metà di ogni tratto; quattro pallini grossi (rallentano i mostri)
  //    lontani dall'ingresso e distanti fra loro
  const exist = []; for (let u = 0; u < N; u++) if (adj[u].length) exist.push(u);
  const bigs = new Set();
  for (let guard = 0; bigs.size < 4 && guard < 600; guard++) {
    const b = exist[int(exist.length)], bi = b % NX, bj = (b / NX) | 0;
    if (Math.abs(bi - entry) + bj <= 4) continue;
    if (guard < 400 && [...bigs].some(o => Math.abs(o % NX - bi) + Math.abs(((o / NX) | 0) - bj) < 6)) continue;
    bigs.add(b);
  }
  const nodePel = [], edgePel = new Map(), pelList = [];
  for (const u of exist) {
    const p = { x: nodes[u].x, y: nodes[u].y, alive: true, big: bigs.has(u), ph: r() * 6.28 };
    nodePel[u] = p; pelList.push(p);
    for (const v of adj[u]) if (u < v) {
      const q = { x: (nodes[u].x + nodes[v].x) / 2, y: (nodes[u].y + nodes[v].y) / 2, alive: true, big: false, ph: r() * 6.28 };
      edgePel.set(ek(u, v), q); pelList.push(q);
    }
  }

  const lanes = []; rows.forEach((t, j) => { if (t === 'L') lanes.push(j); });
  prm.maxCreatures = Math.max(3, Math.round(prm.maxCreatures * (.55 + .45 * lanes.length / NY)));
  return { prm, adj, nodePel, edgePel, pelList, alive: pelList.length, lanes, rooms, entry, exist, name: type.name, type: typeIdx };
}
