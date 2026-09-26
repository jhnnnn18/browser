// App entry point: lifecycle, menu and app-wide security settings.

import { app, BrowserWindow, Menu, session } from 'electron';
import { parseAddressBarPosition } from '../shared/layout';
import { createBrowserWindow } from './window';

// Temporary until there's a settings page: start with
//   npm run dev -- -- --address-bar=bottom
const addressBar = parseAddressBarPosition(app.commandLine.getSwitchValue('address-bar'));

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

  createBrowserWindow({ addressBar });

  // macOS: clicking the dock icon with no windows open makes a new one.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createBrowserWindow({ addressBar });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
