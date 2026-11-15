// Processo principale di Electron: apre la finestra del gioco.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// L'audio deve partire anche se il primo comando arriva dal gamepad.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Modalità di prova: `electron . --selftest=cartella` salva due schermate ed esce.
const selftestArg = process.argv.find(a => a.startsWith('--selftest='));
const selftestDir = selftestArg ? selftestArg.split('=')[1] : null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, useContentSize: true, minWidth: 640, minHeight: 360,
    backgroundColor: '#03040a', title: 'Trivella', autoHideMenuBar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => win.show());

  ipcMain.on('fullscreen', (_e, on) => { if (!selftestDir) win.setFullScreen(!!on); });
  ipcMain.on('quit', () => app.quit());

  if (selftestDir) runSelftest(win);
}

async function runSelftest(win) {
  const wc = win.webContents;
  wc.on('console-message', e => console.log(`[renderer:${e.level}] ${e.message} (${e.sourceId}:${e.lineNumber})`));
  wc.on('render-process-gone', (_e, d) => { console.log('[renderer gone]', d.reason); app.exit(2); });
  await new Promise(r => wc.once('did-finish-load', r));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    await wait(2500);
    fs.writeFileSync(path.join(selftestDir, 'titolo.png'), (await wc.capturePage()).toPNG());
    const state = await wc.executeJavaScript('JSON.stringify(window.__trivella.selftest())');
    console.log('[selftest] ' + state);
    await wait(600);
    fs.writeFileSync(path.join(selftestDir, 'gioco.png'), (await wc.capturePage()).toPNG());
    app.exit(0);
  } catch (err) {
    console.log('[selftest error] ' + (err && err.stack || err));
    app.exit(1);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
