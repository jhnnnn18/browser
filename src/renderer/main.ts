// The browser's own UI: tab strip and address field. It only knows about
// pages through `window.browser` (see src/preload/index.ts) and redraws from
// the WindowState the main process sends.

import type { TabState } from '../shared/ipc';
import { ADDRESS_BAR_HEIGHT, TAB_STRIP_HEIGHT } from '../shared/layout';
import { createTabStrip } from './tabs';

const browser = window.browser;
const address = document.querySelector<HTMLInputElement>('#address')!;
const root = document.documentElement;

root.dataset.platform = browser.platform;
root.style.setProperty('--tab-strip-height', `${TAB_STRIP_HEIGHT}px`);
root.style.setProperty('--address-bar-height', `${ADDRESS_BAR_HEIGHT}px`);

const strip = createTabStrip(document.querySelector('#tabs')!, {
  activate: (id) => browser.activateTab(id),
  close: (id) => browser.closeTab(id),
  move: (id, toIndex) => browser.moveTab(id, toIndex),
  toggleMute: (id) => browser.toggleMute(id),
});
document.querySelector('#new-tab')!.addEventListener('click', () => browser.newTab());

let active: TabState | null = null;

// While you're typing, show what you typed. Otherwise show the page title,
// falling back to the URL.
function renderAddress() {
  root.classList.toggle('loading', active?.loading ?? false);
  document.title = active?.title || 'Browser';
  if (document.activeElement !== address) {
    address.value = active ? active.title || active.url : '';
  }
}

browser.onState((state) => {
  const switched = state.activeId !== active?.id;
  active = state.tabs.find((tab) => tab.id === state.activeId) ?? null;
  root.dataset.addressBar = state.addressBar;
  strip.render(state);
  // Switched tabs while the field has focus (e.g. Ctrl+T while typing):
  // start over with the new tab's address.
  if (switched && document.activeElement === address) {
    address.value = active?.url ?? '';
    address.select();
  }
  renderAddress();
});

browser.onFocusAddress(() => {
  address.focus();
  address.select();
});

address.addEventListener('focus', () => {
  address.value = active?.url ?? '';
  address.select();
});

address.addEventListener('blur', renderAddress);

address.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = address.value;
    address.blur();
    browser.navigate(input);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // First Escape undoes your edits; a second one hands focus back to the page.
    const url = active?.url ?? '';
    if (address.value !== url) {
      address.value = url;
      address.select();
    } else {
      address.blur();
      browser.focusPage();
    }
  }
});

renderAddress();
