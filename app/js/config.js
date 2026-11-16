// Costanti condivise: geometria della mappa, velocità, mostri, potenziamenti.

export const W = 1280, H = 720, GROUND = 150;
export const NX = 19, NY = 8, SP = 64, X0 = 64, Y0 = 212, TW = 30;
export const N = NX * NY, RIG = N;
// La torre (e quindi il pozzo d'ingresso) cambia colonna da un settore all'altro.
export let ENTRY = 9;
export const RIGP = { x: X0 + ENTRY * SP, y: GROUND - 2 };
export function setEntry(col) { ENTRY = col; RIGP.x = X0 + col * SP; }
export const FONT = 'Bahnschrift, "Segoe UI", system-ui, sans-serif';

// Indirizzo del server delle sfide online (Cloudflare Worker "trivella-online", vedi cartella server).
// Se è vuoto la voce "Sfida online" non compare nel menu.
export const ONLINE_URL = 'wss://trivella-online.trivella2026.workers.dev';

export const PAUSE_BTN ={ x: 1246, y: 30, r: 30 };   // pulsante di pausa sugli schermi a tocco

export const EXTEND = 290, RETRACT = 980, HIT_RETRACT = 1300;   // px al secondo
export const SLOW_TIME = 6;      // secondi di mostri rallentati dopo un pallino grosso
export const MAX_LIVES = 4, EXTRA_LIFE_EVERY = 25000;
export const MONSTERS_PER_LIFE = 20;      // una sonda in più ogni tanti mostri mangiati con la bocca

// I mostri "corazzati" non si possono mangiare: toccarli con la bocca costa una sonda.
export const KINDS = [
  { id: 'medusa', hue: 320, pts: 100, speed: 58 },
  { id: 'riccio', hue: 95, pts: 150, speed: 76 },
  { id: 'larva', hue: 255, pts: 200, speed: 96 },
  { id: 'magma', hue: 6, pts: 300, speed: 48, armored: true }
];

export const POWERS = [
  { id: 'gelo', hue: 195, label: 'LENTI', time: SLOW_TIME, pickup: false },   // mostri rallentati: si attiva con i pallini grossi
  { id: 'scudo', hue: 48, label: 'SCUDO', time: 7 },         // il tubo distrugge chi lo tocca
  { id: 'calamita', hue: 285, label: 'CALAMITA', time: 9 },  // attira i cristalli vicini
  { id: 'turbo', hue: 130, label: 'TURBO', time: 8 }         // il tubo avanza e si ritira più in fretta
];
export const TURBO_EXTEND = 1.5, TURBO_RETRACT = 1.3;       // moltiplicatori di velocità con il Turbo

// Ambientazioni: tinta della roccia e dei cristalli, cielo (dall'alto all'orizzonte), bagliore al suolo.
export const PALETTES = [
  { rock: 262, pel: 186, sky: ['#060617', '#1c1046', '#7b2a6c', '#ff8a4c'], glow: '255,150,95' },
  { rock: 205, pel: 160, sky: ['#03101c', '#0a2648', '#1a6478', '#7ff0d0'], glow: '120,240,210' },
  { rock: 320, pel: 55, sky: ['#12040a', '#3a0d22', '#8a1f3a', '#ffb04c'], glow: '255,170,80' },
  { rock: 160, pel: 190, sky: ['#040f0a', '#0c3024', '#2c7448', '#d8ff7a'], glow: '210,255,130' },
  { rock: 285, pel: 130, sky: ['#05051a', '#151a5a', '#4a3aa8', '#ff9ad8'], glow: '255,150,215' },
  { rock: 22, pel: 175, sky: ['#0f0a05', '#3a2210', '#a05a20', '#ffe08a'], glow: '255,220,140' }
];

export const nodes = [];
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) nodes.push({ x: X0 + i * SP, y: Y0 + j * SP });

export const P = id => id === RIG ? RIGP : nodes[id];
export const D = (a, b) => Math.hypot(P(a).x - P(b).x, P(a).y - P(b).y);
export const ek = (a, b) => a < b ? a * 1000 + b : b * 1000 + a;
export const rowOf = id => (id / NX) | 0;

export function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
