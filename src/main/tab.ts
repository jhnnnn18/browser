// One tab: a WebContentsView showing a web page, plus the state the UI needs
// to draw it. The window (window.ts) decides where tabs go and which one is
// visible; a Tab only looks after its own page.

import {
  WebContentsView,
  type HandlerDetails,
  type WebContents,
  type WebContentsViewConstructorOptions,
  type WindowOpenHandlerResponse,
} from 'electron';
import type { FindState, TabState } from '../shared/ipc';

export interface TabOptions {
  id: number;
  openerId: number | null;
  container: string;
  /** Called whenever anything in `state()` may have changed. */
  onChange: (tab: Tab) => void;
  /** The page asked for a new window or tab; see window.ts. */
  onOpen: (tab: Tab, details: HandlerDetails) => WindowOpenHandlerResponse;
  onFullscreen: (tab: Tab, fullscreen: boolean) => void;
  /**
   * For pop-ups: the options Electron hands us in `createWindow`, which carry
   * a page that is already linked to the page that opened it.
   */
  popupOptions?: WebContentsViewConstructorOptions;
}

const SECURE_PREFERENCES = { sandbox: true, contextIsolation: true, nodeIntegration: false };

export class Tab {
  readonly id: number;
  readonly container: string;
  /** Mutable: cleared when the opener closes, so insertion rules stay sane. */
  openerId: number | null;
  readonly view: WebContentsView;
  private readonly onChange: () => void;
  private favicon: string | null = null;
  private find: FindState | null = null;
  /** The last search, offered again when the find bar reopens. */
  private lastQuery = '';
  /** False until the tab has been asked to show something. */
  private started: boolean;

  constructor(options: TabOptions) {
    this.id = options.id;
    this.openerId = options.openerId;
    this.container = options.container;
    this.started = options.popupOptions !== undefined;
    this.view = new WebContentsView(
      options.popupOptions ?? { webPreferences: SECURE_PREFERENCES },
    );

    const contents = this.contents;
    const changed = () => options.onChange(this);
    this.onChange = changed;
    contents.on('did-start-loading', changed);
    contents.on('did-stop-loading', changed);
    contents.on('did-navigate', changed);
    contents.on('did-navigate-in-page', changed);
    contents.on('page-title-updated', changed);
    contents.on('audio-state-changed', changed);
    contents.on('page-favicon-updated', (_event, favicons) => {
      this.favicon = favicons.find((url) => /^(https?|data):/i.test(url)) ?? null;
      changed();
    });
    contents.on('did-start-navigation', (details) => {
      // A new document in the main frame: its icon hasn't been reported yet,
      // and any find results belong to the old page.
      if (details.isMainFrame && !details.isSameDocument) {
        this.favicon = null;
        this.closeFind();
        changed();
      }
    });
    contents.on('found-in-page', (_event, result) => {
      if (!this.find) return;
      this.find = { ...this.find, active: result.activeMatchOrdinal, total: result.matches };
      changed();
    });
    contents.on('enter-html-full-screen', () => options.onFullscreen(this, true));
    contents.on('leave-html-full-screen', () => options.onFullscreen(this, false));
    contents.setWindowOpenHandler((details) => options.onOpen(this, details));
  }

  get contents(): WebContents {
    return this.view.webContents;
  }

  /** Whether this tab has a page to show (a new empty tab doesn't). */
  get hasPage(): boolean {
    return this.started;
  }

  load(url: string) {
    this.started = true;
    void this.contents.loadURL(url).catch(() => {
      // Load failures (bad host, offline, aborted) are reported through
      // did-fail-load; error pages come in a later step.
    });
  }

  toggleMute() {
    this.contents.setAudioMuted(!this.contents.isAudioMuted());
    // Muting doesn't fire any event, so report the change ourselves.
    this.onChange();
  }

  get finding(): boolean {
    return this.find !== null;
  }

  /** Open the find bar (keeping the last search), if there's a page to search. */
  openFind() {
    if (!this.started || this.find) return;
    this.find = { query: this.lastQuery, active: 0, total: 0 };
    if (this.lastQuery) this.findText(this.lastQuery, { forward: true, next: false });
    this.onChange();
  }

  /** Search for `query`; with `next`, move to the next/previous match. */
  findText(query: string, { forward, next }: { forward: boolean; next: boolean }) {
    if (!this.started) return;
    // Same text as before: keep the current count until the new results arrive.
    if (this.find?.query !== query) this.find = { query, active: 0, total: 0 };
    this.lastQuery = query;
    // Careful: Electron's `findNext: true` means "start a new search", the
    // opposite of what the name suggests. A follow-up search is `false`.
    if (query) this.contents.findInPage(query, { forward, findNext: !next });
    else this.contents.stopFindInPage('clearSelection');
    this.onChange();
  }

  closeFind() {
    if (!this.find) return;
    this.find = null;
    if (!this.contents.isDestroyed()) this.contents.stopFindInPage('keepSelection');
    this.onChange();
  }

  state(): TabState {
    const contents = this.contents;
    return {
      id: this.id,
      url: this.started ? contents.getURL() : '',
      title: contents.getTitle(),
      favicon: this.favicon,
      loading: contents.isLoading(),
      audible: contents.isCurrentlyAudible(),
      muted: contents.isAudioMuted(),
      canGoBack: contents.navigationHistory.canGoBack(),
      canGoForward: contents.navigationHistory.canGoForward(),
      container: this.container,
      zoom: contents.getZoomFactor(),
      find: this.find,
    };
  }

  destroy() {
    if (!this.contents.isDestroyed()) this.contents.close();
  }
}
