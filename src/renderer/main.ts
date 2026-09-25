// The toolbar UI. It only knows about the page through `window.browser`
// (see src/preload/index.ts); it never touches the page directly.

import type { PageState } from '../shared/ipc';
import { TOOLBAR_HEIGHT } from '../shared/layout';

const browser = window.browser;
const address = document.querySelector<HTMLInputElement>('#address')!;
const root = document.documentElement;

root.dataset.platform = browser.platform;
root.style.setProperty('--toolbar-height', `${TOOLBAR_HEIGHT}px`);

let state: PageState = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false };

// While you're typing, show what you typed. Otherwise show the page title,
// falling back to the URL.
function render() {
  root.classList.toggle('loading', state.loading);
  document.title = state.title || 'Browser';
  if (document.activeElement !== address) {
    address.value = state.title || state.url;
  }
}

browser.onState((next) => {
  state = next;
  render();
});

browser.onFocusAddress(() => {
  address.focus();
  address.select();
});

address.addEventListener('focus', () => {
  address.value = state.url;
  address.select();
});

address.addEventListener('blur', render);

address.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = address.value;
    address.blur();
    browser.navigate(input);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // First Escape undoes your edits; a second one hands focus back to the page.
    if (address.value !== state.url) {
      address.value = state.url;
      address.select();
    } else {
      address.blur();
      browser.focusPage();
    }
  }
});

render();
