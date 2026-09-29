// The complete contract between the UI (renderer) and the main process.
// Every message that crosses the preload bridge is named here, so this file
// is the one place to look to see what the UI is allowed to ask for.

import type { AddressBarPosition } from './layout';

export const Channels = {
  // renderer -> main: navigation (always applies to the active tab)
  navigate: 'nav:navigate',
  back: 'nav:back',
  forward: 'nav:forward',
  reload: 'nav:reload',
  stop: 'nav:stop',
  focusPage: 'ui:focus-page',
  // renderer -> main: tabs
  newTab: 'tabs:new',
  closeTab: 'tabs:close',
  activateTab: 'tabs:activate',
  moveTab: 'tabs:move',
  toggleMute: 'tabs:toggle-mute',
  tabMenu: 'tabs:menu',
  // renderer -> main: find and zoom (active tab)
  find: 'find:query',
  stopFind: 'find:stop',
  resetZoom: 'zoom:reset',
  // main -> renderer
  state: 'window:state',
  focusAddress: 'ui:focus-address',
  focusFind: 'ui:focus-find',
} as const;

/** Find in page, while the find bar is open for a tab. */
export interface FindState {
  query: string;
  /** Which match is highlighted (1-based), 0 if none. */
  active: number;
  total: number;
}

/** What the UI needs to know about one tab. */
export interface TabState {
  id: number;
  url: string;
  title: string;
  /** URL of the site's icon, if it has told us one. */
  favicon: string | null;
  loading: boolean;
  /** Currently playing sound (whether or not it's muted). */
  audible: boolean;
  muted: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Which container the tab belongs to. Only "default" exists for now. */
  container: string;
  /** Zoom factor: 1 is 100%. Shared by all tabs on the same site. */
  zoom: number;
  /** Null when the find bar isn't open for this tab. */
  find: FindState | null;
}

/**
 * Everything the UI draws. The main process sends a fresh copy whenever
 * anything changes; the UI never keeps its own version of the tab list.
 */
export interface WindowState {
  tabs: TabState[];
  activeId: number | null;
  addressBar: AddressBarPosition;
}

/** The API the preload script exposes to the UI as `window.browser`. */
export interface BrowserApi {
  platform: string;
  navigate(input: string): void;
  back(): void;
  forward(): void;
  reload(): void;
  stop(): void;
  focusPage(): void;
  newTab(): void;
  closeTab(id: number): void;
  activateTab(id: number): void;
  moveTab(id: number, toIndex: number): void;
  toggleMute(id: number): void;
  /** Show the right-click menu for a tab. */
  tabMenu(id: number): void;
  /**
   * Search the active tab. With `next`, move to the next (or, with
   * `forward: false`, previous) match of the same text.
   */
  find(text: string, options: { forward: boolean; next: boolean }): void;
  stopFind(): void;
  resetZoom(): void;
  /** Subscribe to window state changes. Returns an unsubscribe function. */
  onState(listener: (state: WindowState) => void): () => void;
  onFocusAddress(listener: () => void): () => void;
  onFocusFind(listener: () => void): () => void;
}
