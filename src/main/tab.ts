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
import type { TabState } from '../shared/ipc';

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
      // A new document in the main frame: its icon hasn't been reported yet.
      if (details.isMainFrame && !details.isSameDocument) {
        this.favicon = null;
        changed();
      }
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
    };
  }

  destroy() {
    if (!this.contents.isDestroyed()) this.contents.close();
  }
}
