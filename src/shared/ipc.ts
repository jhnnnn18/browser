// The complete contract between the UI (renderer) and the main process.
// Every message that crosses the preload bridge is named here, so this file
// is the one place to look to see what the UI is allowed to ask for.

export const Channels = {
  // renderer -> main
  navigate: 'nav:navigate',
  back: 'nav:back',
  forward: 'nav:forward',
  reload: 'nav:reload',
  stop: 'nav:stop',
  focusPage: 'ui:focus-page',
  // main -> renderer
  state: 'nav:state',
  focusAddress: 'ui:focus-address',
} as const;

/** What the UI needs to know about the page to draw the toolbar. */
export interface PageState {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
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
  /** Subscribe to page state changes. Returns an unsubscribe function. */
  onState(listener: (state: PageState) => void): () => void;
  onFocusAddress(listener: () => void): () => void;
}
