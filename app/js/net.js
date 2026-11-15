// Collegamento con il server delle sfide online (vedi server/src/worker.js).
//   quick()     partita veloce: aspetta in lobby finché arriva un altro giocatore
//   host()      crea una partita privata e ottiene un codice di 5 cifre da comunicare
//   join(code)  entra in una partita privata con il codice
// onStatus(stato, info): 'waiting' (info = codice, se c'è) · 'ready' (info = ruolo 0/1) ·
//                        'error' (info = messaggio) · 'bye' (l'avversario è uscito) · 'offline'
// onMessage(msg): messaggi dell'altro giocatore.
import { ONLINE_URL } from './config.js';

function serverUrl() {
  try { const o = localStorage.getItem('trivella.server'); if (o) return o; } catch (err) { /* archivio non disponibile */ }
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'ws://localhost:8787';   // prove sul PC
  return ONLINE_URL;
}
const newCode = () => String(10000 + Math.floor(Math.random() * 90000));
// Finché il server non è pubblicato la voce "Sfida online" non compare nel menu.
export const onlineAvailable = () => !!serverUrl();

export class Net {
  constructor() {
    this.ws = null; this.gen = 0; this.paired = false;
    this.onStatus = () => { }; this.onMessage = () => { };
    setInterval(() => { if (this.ws && this.ws.readyState === 1) this.ws.send('ping'); }, 25000);   // tiene viva la connessione
  }

  quick() {
    this.connect('lobby', '', () => this.onStatus('waiting', ''), m => { if (m.t === 'match') this.room(m.code, ''); });
  }
  host() { this.room(newCode(), 'host'); }
  join(code) { this.room(code, 'join'); }

  room(code, mode) {
    this.connect(code, mode, () => { if (mode === 'host') this.onStatus('waiting', code); }, m => {
      if (m.t === 'refused') {
        this.drop();
        if (m.why === 'taken') this.host();                      // codice già in uso: ne provo un altro
        else this.onStatus('error', m.why === 'empty' ? 'Nessuna partita con questo codice' : 'La partita è già al completo');
      } else if (m.t === 'ready') { this.paired = true; this.onStatus('ready', m.role); }
      else if (m.t === 'bye') { this.paired = false; this.onStatus('bye'); }
      else if (this.paired) this.onMessage(m);
    });
  }

  connect(room, mode, onOpen, onMsg) {
    this.drop();
    const base = serverUrl();
    if (!base) { this.onStatus('error', 'Il server delle sfide non è ancora attivo'); return; }
    const gen = this.gen; let opened = false, ws;
    try { ws = new WebSocket(`${base}/ws?room=${room}${mode ? '&mode=' + mode : ''}`); }
    catch (err) { this.onStatus('error', 'Server non raggiungibile'); return; }
    this.ws = ws;
    const timer = setTimeout(() => { if (!opened && gen === this.gen) { this.drop(); this.onStatus('error', 'Server non raggiungibile'); } }, 10000);
    ws.onopen = () => { opened = true; clearTimeout(timer); if (gen === this.gen) onOpen(); };
    ws.onmessage = ev => {
      if (gen !== this.gen || typeof ev.data !== 'string' || ev.data === 'pong') return;
      let m; try { m = JSON.parse(ev.data); } catch (err) { return; }
      if (m && typeof m === 'object') onMsg(m);
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (gen !== this.gen) return;                 // chiusura voluta o connessione già sostituita
      this.ws = null; const wasPaired = this.paired; this.paired = false;
      this.onStatus(wasPaired ? 'offline' : 'error', opened ? 'Collegamento interrotto' : 'Server non raggiungibile');
    };
  }

  send(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }

  // chiude senza generare altri avvisi
  drop() {
    this.gen++; this.paired = false;
    const ws = this.ws; this.ws = null;
    if (ws) { try { ws.close(); } catch (err) { /* già chiuso */ } }
  }
  close() { this.drop(); }
}
