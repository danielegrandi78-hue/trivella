// Server delle sfide online di Trivella (Cloudflare Workers + Durable Objects).
// Non conosce le regole del gioco: mette in contatto due giocatori e inoltra i loro messaggi.
//
//   /ws?room=lobby            partita veloce: appena ci sono due giocatori in attesa li abbina,
//                             comunica a entrambi lo stesso codice di stanza e li congeda
//   /ws?room=12345            stanza da due giocatori; il primo che entra aspetta il secondo
//   /ws?room=12345&mode=host  crea la stanza: rifiutata se quel codice è già in uso
//   /ws?room=12345&mode=join  entra con un codice: rifiutata se nella stanza non c'è nessuno
//
// Messaggi del server: {t:'match',code} {t:'ready',role} {t:'refused',why} {t:'bye'}.
// Tutto il resto viene inoltrato così com'è all'altro giocatore della stanza.

const MAX_MESSAGE = 16 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/ws') return new Response('Trivella online', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Serve una connessione WebSocket', { status: 426 });
    const room = url.searchParams.get('room') || '';
    if (!/^(lobby|\d{5})$/.test(room)) return new Response('Stanza non valida', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
  }
};

export class Room {
  constructor(state) {
    this.state = state;
    // risponde ai "ping" dei client senza risvegliare la stanza
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url), room = url.searchParams.get('room'), mode = url.searchParams.get('mode') || '';
    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    const others = this.state.getWebSockets();
    this.state.acceptWebSocket(server);
    const say = (ws, msg) => { try { ws.send(JSON.stringify(msg)); } catch (err) { /* già chiuso */ } };
    const refuse = why => { say(server, { t: 'refused', why }); try { server.close(4000, why); } catch (err) { /* già chiuso */ } };

    if (room === 'lobby') {
      if (others.length) {                      // c'è qualcuno in attesa: li abbino
        const code = String(10000 + Math.floor(Math.random() * 90000));
        for (const ws of [others[0], server]) { say(ws, { t: 'match', code }); try { ws.close(1000, 'match'); } catch (err) { /* già chiuso */ } }
      }
    } else if (mode === 'host' && others.length) refuse('taken');
    else if (mode === 'join' && !others.length) refuse('empty');
    else if (others.length >= 2) refuse('full');
    else if (others.length === 1) { say(others[0], { t: 'ready', role: 0 }); say(server, { t: 'ready', role: 1 }); }

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    for (const other of this.state.getWebSockets()) if (other !== ws) { try { other.send(message); } catch (err) { /* già chiuso */ } }
  }

  webSocketClose(ws) { this.left(ws); }
  webSocketError(ws) { this.left(ws); }
  left(ws) {
    try { ws.close(1000, 'bye'); } catch (err) { /* già chiuso */ }
    for (const other of this.state.getWebSockets()) if (other !== ws) { try { other.send('{"t":"bye"}'); } catch (err) { /* già chiuso */ } }
  }
}
