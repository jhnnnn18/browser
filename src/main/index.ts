// App entry point: lifecycle, menu and app-wide security settings.

import { app, BrowserWindow, Menu, session } from 'electron';
import { createBrowserWindow } from './window';

// Permissions a website may use without asking. Everything else (camera,
// microphone, location, notifications...) is denied until we build a
// permission prompt.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);

function setUpMenu() {
  if (process.platform === 'darwin') {
    // macOS needs an Edit menu for Cmd+C / Cmd+V to work at all.
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]),
    );
  } else {
    // Windows and Linux handle clipboard keys natively; no menu bar.
    Menu.setApplicationMenu(null);
  }
}

app.on('web-contents-created', (_event, contents) => {
  // Nobody gets to embed <webview> tags.
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.whenReady().then(() => {
  setUpMenu();

  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });

  createBrowserWindow();

  // macOS: clicking the dock icon with no windows open makes a new one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createBrowserWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
