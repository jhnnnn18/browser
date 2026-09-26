// The browser's own UI: tab strip, address field and find bar. It only knows
// about pages through `window.browser` (see src/preload/index.ts) and redraws
// from the WindowState the main process sends.

import type { TabState } from '../shared/ipc';
import { ADDRESS_BAR_HEIGHT, TAB_STRIP_HEIGHT } from '../shared/layout';
import { createTabStrip } from './tabs';

const browser = window.browser;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const address = $<HTMLInputElement>('#address');
const zoomBadge = $<HTMLButtonElement>('#zoom');
const field = $('#field');
const findbar = $('#findbar');
const findInput = $<HTMLInputElement>('#find');
const findCount = $('#find-count');
const root = document.documentElement;

root.dataset.platform = browser.platform;
root.style.setProperty('--tab-strip-height', `${TAB_STRIP_HEIGHT}px`);
root.style.setProperty('--address-bar-height', `${ADDRESS_BAR_HEIGHT}px`);

const strip = createTabStrip($('#tabs'), {
  activate: (id) => browser.activateTab(id),
  close: (id) => browser.closeTab(id),
  move: (id, toIndex) => browser.moveTab(id, toIndex),
  toggleMute: (id) => browser.toggleMute(id),
  menu: (id) => browser.tabMenu(id),
});
$('#new-tab').addEventListener('click', () => browser.newTab());

let active: TabState | null = null;

// --- Address field ------------------------------------------------------------

// While you're typing, show what you typed. Otherwise show the page title,
// falling back to the URL.
function renderAddress() {
  root.classList.toggle('loading', active?.loading ?? false);
  document.title = active?.title || 'Browser';
  if (document.activeElement !== address) {
    address.value = active ? active.title || active.url : '';
  }
  const zoom = active?.zoom ?? 1;
  zoomBadge.hidden = Math.abs(zoom - 1) < 0.001;
  zoomBadge.textContent = `${Math.round(zoom * 100)}%`;
}

zoomBadge.addEventListener('click', () => browser.resetZoom());

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

// --- Find bar -----------------------------------------------------------------
// The find bar takes the address field's place while the active tab is
// finding. Whether it's open is part of the tab's state, so switching tabs
// shows each tab's own find bar (or none).

function renderFind() {
  const find = active?.find ?? null;
  findbar.hidden = find === null;
  field.hidden = find !== null;
  if (!find) return;
  if (document.activeElement !== findInput) findInput.value = find.query;
  findCount.textContent = find.query ? `${find.active}/${find.total}` : '';
  findbar.classList.toggle('no-matches', find.query !== '' && find.total === 0);
}

browser.onFocusFind(() => {
  findbar.hidden = false;
  field.hidden = true;
  findInput.focus();
  findInput.select();
});

findInput.addEventListener('input', () => {
  browser.find(findInput.value, { forward: true, next: false });
});

findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (findInput.value) browser.find(findInput.value, { forward: !event.shiftKey, next: true });
  } else if (event.key === 'Escape') {
    event.preventDefault();
    browser.stopFind();
  }
});

$('#find-next').addEventListener('click', () => {
  if (findInput.value) browser.find(findInput.value, { forward: true, next: true });
});
$('#find-previous').addEventListener('click', () => {
  if (findInput.value) browser.find(findInput.value, { forward: false, next: true });
});
$('#find-close').addEventListener('click', () => browser.stopFind());

// --- State from the main process ------------------------------------------------

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
  if (switched && document.activeElement === findInput) findInput.blur();
  renderAddress();
  renderFind();
});

renderAddress();
