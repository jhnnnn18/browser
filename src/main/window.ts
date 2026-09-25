// One browser window: the toolbar UI on top, one web page underneath.
//
//   BrowserWindow
//   ├── webContents        -> our UI (src/renderer), fills the window
//   └── WebContentsView    -> the website, placed below the toolbar
//
// The UI and the page never talk to each other directly. The UI sends
// requests over IPC (see src/shared/ipc.ts); this file acts on them and
// pushes page state back.

import { BrowserWindow, WebContentsView, ipcMain, nativeTheme, type IpcMainEvent } from 'electron';
import { join } from 'node:path';
import { Channels, type PageState } from '../shared/ipc';
import { TOOLBAR_HEIGHT } from '../shared/layout';
import { toUrl } from './navigation';
import { actionFor, type Action } from './shortcuts';

const LIGHT = { background: '#ffffff', foreground: '#1f1f1f' };
const DARK = { background: '#1f1f1f', foreground: '#f2f2f2' };

function colors() {
  return nativeTheme.shouldUseDarkColors ? DARK : LIGHT;
}

export function createBrowserWindow(): BrowserWindow {
  const platform = process.platform;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    show: false,
    backgroundColor: colors().background,
    // Hide the OS title bar so the toolbar can sit at the very top.
    // macOS keeps its traffic lights; Windows draws its buttons over our UI.
    // Linux keeps the normal title bar for now (frameless windows on
    // Wayland have quirks we'll deal with later).
    ...(platform === 'darwin' && {
      titleBarStyle: 'hidden' as const,
      trafficLightPosition: { x: 14, y: 14 },
    }),
    ...(platform === 'win32' && {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: colors().background,
        symbolColor: colors().foreground,
        height: TOOLBAR_HEIGHT,
      },
    }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const ui = win.webContents;
  const page = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const pageContents = page.webContents;

  // The page view is only added on the first navigation, so a fresh window
  // shows just the toolbar on an empty background (no start page).
  let pageAttached = false;
  let fullscreen = false;

  function layout() {
    const { width, height } = win.getContentBounds();
    const top = fullscreen ? 0 : TOOLBAR_HEIGHT;
    page.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
  }

  function sendState() {
    if (ui.isDestroyed()) return;
    const state: PageState = {
      url: pageAttached ? pageContents.getURL() : '',
      title: pageContents.getTitle(),
      loading: pageContents.isLoading(),
      canGoBack: pageContents.navigationHistory.canGoBack(),
      canGoForward: pageContents.navigationHistory.canGoForward(),
    };
    ui.send(Channels.state, state);
  }

  function focusAddress() {
    ui.focus();
    ui.send(Channels.focusAddress);
  }

  function navigate(input: string) {
    const url = toUrl(input);
    if (!url) return;
    if (!pageAttached) {
      win.contentView.addChildView(page);
      pageAttached = true;
      layout();
    }
    void pageContents.loadURL(url).catch(() => {
      // Load failures (bad host, offline, aborted) are reported through
      // did-fail-load; nothing to do here yet.
    });
    pageContents.focus();
  }

  function run(action: Action) {
    const history = pageContents.navigationHistory;
    switch (action) {
      case 'focus-address':
        focusAddress();
        break;
      case 'back':
        if (history.canGoBack()) history.goBack();
        break;
      case 'forward':
        if (history.canGoForward()) history.goForward();
        break;
      case 'reload':
        if (pageAttached) pageContents.reload();
        break;
    }
  }

  // --- Page events -> state updates for the toolbar -----------------------
  pageContents.on('did-start-loading', sendState);
  pageContents.on('did-stop-loading', sendState);
  pageContents.on('did-navigate', sendState);
  pageContents.on('did-navigate-in-page', sendState);
  pageContents.on('page-title-updated', sendState);

  // Links that want a new window load in this one until we have tabs.
  pageContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void pageContents.loadURL(url);
    return { action: 'deny' };
  });

  // Video fullscreen: let the page cover the toolbar.
  pageContents.on('enter-html-full-screen', () => {
    fullscreen = true;
    layout();
  });
  pageContents.on('leave-html-full-screen', () => {
    fullscreen = false;
    layout();
  });

  // --- Keyboard shortcuts, wherever focus is ------------------------------
  for (const contents of [ui, pageContents]) {
    contents.on('before-input-event', (event, input) => {
      const action = actionFor(input, platform);
      if (action) {
        event.preventDefault();
        run(action);
      }
    });
  }

  // --- Requests from the UI -----------------------------------------------
  // Every window registers these, so each one ignores messages that didn't
  // come from its own UI. Arguments come from the renderer and are checked
  // before use.
  const listeners: [string, (event: IpcMainEvent, ...args: unknown[]) => void][] = [];
  function handle(channel: string, handler: (...args: unknown[]) => void) {
    const listener = (event: IpcMainEvent, ...args: unknown[]) => {
      if (event.sender === ui) handler(...args);
    };
    ipcMain.on(channel, listener);
    listeners.push([channel, listener]);
  }

  handle(Channels.navigate, (input) => {
    if (typeof input === 'string') navigate(input);
  });
  handle(Channels.back, () => run('back'));
  handle(Channels.forward, () => run('forward'));
  handle(Channels.reload, () => run('reload'));
  handle(Channels.stop, () => pageContents.stop());
  handle(Channels.focusPage, () => {
    if (pageAttached) pageContents.focus();
  });

  // --- Theme ----------------------------------------------------------------
  const onThemeUpdated = () => {
    win.setBackgroundColor(colors().background);
    if (platform === 'win32') {
      win.setTitleBarOverlay({ color: colors().background, symbolColor: colors().foreground });
    }
  };
  nativeTheme.on('updated', onThemeUpdated);

  // --- Window lifecycle -----------------------------------------------------
  win.on('resize', layout);
  ui.on('did-finish-load', () => {
    sendState();
    focusAddress();
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    for (const [channel, listener] of listeners) ipcMain.removeListener(channel, listener);
    nativeTheme.removeListener('updated', onThemeUpdated);
    pageContents.close();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
