// One browser window: the UI on top, the active tab's page underneath.
//
//   BrowserWindow
//   ├── webContents        -> our UI (src/renderer), fills the window
//   └── WebContentsView    -> the active tab's page (others are detached)
//
// This file owns the tab list. The UI never changes it directly: it sends
// requests over IPC (see src/shared/ipc.ts), this file acts on them, and
// sends the whole WindowState back.

import {
  BrowserWindow,
  ipcMain,
  nativeTheme,
  type HandlerDetails,
  type IpcMainEvent,
  type WindowOpenHandlerResponse,
} from 'electron';
import { join } from 'node:path';
import { Channels, type WindowState } from '../shared/ipc';
import { computeLayout, TAB_STRIP_HEIGHT, type AddressBarPosition } from '../shared/layout';
import { forwardConsole } from './dev-console';
import { toUrl } from './navigation';
import { actionFor, type Action } from './shortcuts';
import { Tab } from './tab';
import { cycleIndex, indexForNumber, insertionIndex, moveItem, nextActiveIndex } from './tab-list';

const LIGHT = { background: '#ffffff', foreground: '#1f1f1f' };
const DARK = { background: '#1f1f1f', foreground: '#f2f2f2' };
/** How many closed tabs Ctrl+Shift+T can bring back. */
const MAX_CLOSED_TABS = 25;

function colors() {
  return nativeTheme.shouldUseDarkColors ? DARK : LIGHT;
}

export interface WindowOptions {
  addressBar: AddressBarPosition;
}

// Tab ids are unique across all windows.
let nextTabId = 1;

export function createBrowserWindow({ addressBar }: WindowOptions): BrowserWindow {
  const platform = process.platform;

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    show: false,
    backgroundColor: colors().background,
    // Hide the OS title bar so the tab strip can sit at the very top.
    // macOS keeps its traffic lights; Windows draws its buttons over the
    // tab strip. Linux keeps the normal title bar for now (frameless windows
    // on Wayland have quirks we'll deal with later).
    ...(platform === 'darwin' && {
      titleBarStyle: 'hidden' as const,
      trafficLightPosition: { x: 14, y: 11 },
    }),
    ...(platform === 'win32' && {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: colors().background,
        symbolColor: colors().foreground,
        height: TAB_STRIP_HEIGHT,
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
  let tabs: Tab[] = [];
  let active: Tab | null = null;
  /** The tab whose page is currently visible. */
  let shown: Tab | null = null;
  let fullscreen = false;
  const closedUrls: { url: string; index: number }[] = [];

  // --- Layout ---------------------------------------------------------------
  function layout() {
    if (!shown) return;
    const { width, height } = win.getContentBounds();
    shown.view.setBounds(computeLayout({ width, height, addressBar, fullscreen }).page);
  }

  /**
   * Show the active tab's page (if it has one) and hide the previous one.
   * Pages stay attached to the window once shown and are hidden rather than
   * removed: a page that's removed and added back never learns it's visible
   * again, so it stops painting.
   */
  function showActive() {
    const next = active?.hasPage ? active : null;
    if (next === shown) return;
    shown?.view.setVisible(false);
    shown = next;
    if (shown) {
      // Adding a view that's already attached just moves it to the top.
      win.contentView.addChildView(shown.view);
      shown.view.setVisible(true);
      layout();
    }
  }

  // --- State for the UI -----------------------------------------------------
  // Several changes often happen together (e.g. title + loading), so they're
  // gathered up and sent as one message.
  let stateQueued = false;
  function sendState() {
    if (stateQueued) return;
    stateQueued = true;
    setImmediate(() => {
      stateQueued = false;
      if (ui.isDestroyed()) return;
      const state: WindowState = {
        tabs: tabs.map((tab) => tab.state()),
        activeId: active?.id ?? null,
        addressBar,
      };
      ui.send(Channels.state, state);
    });
  }

  function focusAddress() {
    ui.focus();
    ui.send(Channels.focusAddress);
  }

  function focusActive() {
    if (active?.hasPage) active.contents.focus();
    else focusAddress();
  }

  // --- Tabs -----------------------------------------------------------------
  function createTab(options: {
    url?: string;
    openerId?: number | null;
    activate: boolean;
    index?: number;
    popupOptions?: Electron.WebContentsViewConstructorOptions;
  }): Tab {
    const openerId = options.openerId ?? null;
    const tab = new Tab({
      id: nextTabId++,
      openerId,
      container: 'default',
      popupOptions: options.popupOptions,
      onChange: sendState,
      onOpen: handleOpen,
      onFullscreen: (t, on) => {
        if (t !== active) return;
        fullscreen = on;
        layout();
      },
    });
    // Shortcuts work while the page has focus, too.
    tab.contents.on('before-input-event', handleInput);
    forwardConsole(tab.contents, () => `tab ${tab.id} ${hostOf(tab.state().url)}`.trim(), { isPage: true });

    const index = options.index ?? insertionIndex(tabs, openerId);
    tabs.splice(Math.min(index, tabs.length), 0, tab);
    if (options.url) tab.load(options.url);
    if (options.activate) activate(tab);
    sendState();
    return tab;
  }

  function activate(tab: Tab) {
    // Switching away from a fullscreen video (e.g. with Ctrl+Tab) ends it.
    if (fullscreen && active && active !== tab) {
      fullscreen = false;
      active.contents.executeJavaScript('document.exitFullscreen?.()').catch(() => {});
    }
    active = tab;
    showActive();
    focusActive();
    sendState();
  }

  function closeTab(tab: Tab) {
    const index = tabs.indexOf(tab);
    if (index === -1) return;

    const url = tab.state().url;
    if (url) {
      closedUrls.push({ url, index });
      if (closedUrls.length > MAX_CLOSED_TABS) closedUrls.shift();
    }

    tabs.splice(index, 1);
    for (const other of tabs) if (other.openerId === tab.id) other.openerId = null;
    // Background tabs that were never shown aren't attached.
    if (win.contentView.children.includes(tab.view)) win.contentView.removeChildView(tab.view);
    if (shown === tab) shown = null;
    tab.destroy();

    if (tabs.length === 0) {
      active = null;
      win.close();
      return;
    }
    if (active === tab) activate(tabs[nextActiveIndex(index, tabs.length)]!);
    sendState();
  }

  function reopenClosedTab() {
    const last = closedUrls.pop();
    if (last) createTab({ url: last.url, activate: true, index: last.index });
  }

  function moveTab(tab: Tab, toIndex: number) {
    tabs = moveItem(tabs, tabs.indexOf(tab), toIndex);
    sendState();
  }

  const byId = (id: unknown) => tabs.find((tab) => tab.id === id);
  const hostOf = (url: string) => (URL.canParse(url) ? new URL(url).host : '');

  // Pages asking for a new window: links with target="_blank", Ctrl+click,
  // middle-click, window.open() and pop-ups all become tabs.
  function handleOpen(opener: Tab, details: HandlerDetails): WindowOpenHandlerResponse {
    if (!/^(https?|about):/i.test(details.url)) return { action: 'deny' };
    const background = details.disposition === 'background-tab';
    return {
      action: 'allow',
      // Closing the page that opened a tab shouldn't close the tab.
      outlivesOpener: true,
      // Electron gives us the new page already linked to its opener
      // (window.opener works, so "Sign in with..." pop-ups can report back).
      // We put it in a tab instead of a new window.
      createWindow: (popupOptions) => {
        const tab = createTab({
          openerId: opener.id,
          activate: !background,
          popupOptions: popupOptions as Electron.WebContentsViewConstructorOptions,
        });
        return tab.contents;
      },
    };
  }

  // --- Commands (from shortcuts and the UI) ---------------------------------
  function navigate(input: string) {
    const url = toUrl(input);
    if (!url) return;
    const tab = active ?? createTab({ activate: true });
    tab.load(url);
    showActive();
    tab.contents.focus();
    sendState();
  }

  function run(action: Action) {
    const history = active?.contents.navigationHistory;
    const current = active ? tabs.indexOf(active) : -1;
    switch (action) {
      case 'focus-address':
        focusAddress();
        break;
      case 'back':
        if (history?.canGoBack()) history.goBack();
        break;
      case 'forward':
        if (history?.canGoForward()) history.goForward();
        break;
      case 'reload':
        if (active?.hasPage) active.contents.reload();
        break;
      case 'new-tab':
        createTab({ activate: true });
        break;
      case 'close-tab':
        if (active) closeTab(active);
        break;
      case 'reopen-tab':
        reopenClosedTab();
        break;
      case 'next-tab':
      case 'previous-tab': {
        const next = tabs[cycleIndex(current, action === 'next-tab' ? 1 : -1, tabs.length)];
        if (next) activate(next);
        break;
      }
      case 'devtools':
        if (!active?.hasPage) break;
        if (active.contents.isDevToolsOpened()) active.contents.closeDevTools();
        else active.contents.openDevTools({ mode: 'detach' });
        break;
      default: {
        // tab-1 ... tab-9
        const target = tabs[indexForNumber(Number(action.slice(4)), tabs.length)];
        if (target) activate(target);
      }
    }
  }

  function handleInput(event: Electron.Event, input: Electron.Input) {
    const action = actionFor(input, platform);
    if (action) {
      event.preventDefault();
      run(action);
    }
  }
  ui.on('before-input-event', handleInput);
  forwardConsole(ui, () => 'ui');

  // --- Requests from the UI -------------------------------------------------
  // Every window registers these, so each one ignores messages that didn't
  // come from its own UI. Arguments come from the renderer and are checked
  // before use; unknown tab ids (e.g. a tab closed a moment ago) are ignored.
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
  handle(Channels.stop, () => active?.contents.stop());
  handle(Channels.focusPage, () => {
    if (active?.hasPage) active.contents.focus();
  });
  handle(Channels.newTab, () => run('new-tab'));
  handle(Channels.closeTab, (id) => {
    const tab = byId(id);
    if (tab) closeTab(tab);
  });
  handle(Channels.activateTab, (id) => {
    const tab = byId(id);
    if (tab) activate(tab);
  });
  handle(Channels.moveTab, (id, toIndex) => {
    const tab = byId(id);
    if (tab && Number.isInteger(toIndex)) moveTab(tab, toIndex as number);
  });
  handle(Channels.toggleMute, (id) => byId(id)?.toggleMute());

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
    focusActive();
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    for (const [channel, listener] of listeners) ipcMain.removeListener(channel, listener);
    nativeTheme.removeListener('updated', onThemeUpdated);
    for (const tab of tabs) tab.destroy();
    tabs = [];
  });

  // Every window starts with one empty tab.
  createTab({ activate: true });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
