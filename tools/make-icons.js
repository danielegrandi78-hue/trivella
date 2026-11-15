// Genera le icone del gioco disegnandole su un canvas (nessun file grafico esterno).
// Uso:  npx electron tools/make-icons.js
//   app/icons/icon-180.png, icon-192.png, icon-512.png  -> versione web (iPhone, iPad, Android)
//   build/icon.ico                                      -> eseguibile Windows
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// Eseguita dentro la pagina: disegna l'icona al lato richiesto e la restituisce come PNG (data URL).
function drawIcon(size) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), s = size / 512; g.scale(s, s);
  let gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#2a1560'); gr.addColorStop(.55, '#150a35'); gr.addColorStop(1, '#05040f');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  // corsia con cristalli
  g.fillStyle = '#04050c'; g.fillRect(0, 352, 512, 84);
  g.fillStyle = 'rgba(120,90,200,.55)'; g.fillRect(0, 346, 512, 6); g.fillRect(0, 436, 512, 6);
  for (const x of [56, 136, 376, 456]) {
    gr = g.createRadialGradient(x, 394, 0, x, 394, 30);
    gr.addColorStop(0, 'rgba(110,240,255,.9)'); gr.addColorStop(1, 'rgba(110,240,255,0)');
    g.fillStyle = gr; g.fillRect(x - 30, 364, 60, 60);
    g.fillStyle = '#bff8ff'; g.beginPath(); g.arc(x, 394, 11, 0, 6.283); g.fill();
  }
  // pozzo, tubo e alone
  g.fillStyle = '#04050c'; g.fillRect(214, 0, 84, 360);
  gr = g.createRadialGradient(256, 330, 0, 256, 330, 190);
  gr.addColorStop(0, 'rgba(255,150,50,.6)'); gr.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = gr; g.fillRect(40, 120, 432, 400);
  g.fillStyle = '#2a1608'; g.fillRect(232, 0, 48, 250);
  g.fillStyle = '#ff9d3c'; g.fillRect(241, 0, 30, 250);
  g.fillStyle = '#fff1c8'; for (let y = 14; y < 240; y += 44) g.fillRect(252, y, 8, 20);
  // bocca della trivella, punta verso il basso
  gr = g.createLinearGradient(196, 0, 316, 0);
  gr.addColorStop(0, '#ffd08a'); gr.addColorStop(.5, '#ff8f2e'); gr.addColorStop(1, '#a8420e');
  g.fillStyle = gr; g.beginPath(); g.roundRect(196, 226, 120, 96, 30); g.fill();
  g.fillStyle = '#8ff4ff'; g.beginPath(); g.arc(256, 268, 19, 0, 6.283); g.fill();
  gr = g.createLinearGradient(200, 0, 312, 0);
  gr.addColorStop(0, '#f4f6ff'); gr.addColorStop(.5, '#9aa3c4'); gr.addColorStop(1, '#3a4060');
  g.fillStyle = gr; g.beginPath(); g.moveTo(200, 326); g.lineTo(312, 326); g.lineTo(256, 428); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(20,22,40,.7)'; g.lineWidth = 9;
  g.save(); g.clip();
  for (let y = 336; y < 440; y += 26) { g.beginPath(); g.moveTo(190, y + 22); g.lineTo(322, y - 14); g.stroke(); }
  g.restore();
  return c.toDataURL('image/png');
}

// File .ico con dentro le immagini PNG (formato accettato da Windows Vista in poi).
function makeIco(pngs) {
  const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  const entries = []; let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += data.length;
  }
  return Buffer.concat([head, ...entries, ...pngs.map(p => p.data)]);
}

app.whenReady().then(async () => {
  try {
    const root = path.join(__dirname, '..');
    const win = new BrowserWindow({ show: false });
    await win.loadURL('about:blank');
    const png = async size => Buffer.from((await win.webContents.executeJavaScript(`(${drawIcon.toString()})(${size})`)).split(',')[1], 'base64');
    fs.mkdirSync(path.join(root, 'app', 'icons'), { recursive: true });
    fs.mkdirSync(path.join(root, 'build'), { recursive: true });
    for (const size of [180, 192, 512]) fs.writeFileSync(path.join(root, 'app', 'icons', `icon-${size}.png`), await png(size));
    const ico = [];
    for (const size of [256, 64, 48, 32, 16]) ico.push({ size, data: await png(size) });
    fs.writeFileSync(path.join(root, 'build', 'icon.ico'), makeIco(ico));
    console.log('icone create');
    app.exit(0);
  } catch (err) { console.log('errore: ' + (err && err.stack || err)); app.exit(1); }
});
