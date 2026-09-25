import type { BrowserApi } from '../shared/ipc';

declare global {
  interface Window {
    /** Provided by src/preload/index.ts. */
    browser: BrowserApi;
  }
}
