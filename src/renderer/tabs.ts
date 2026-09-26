// The tab strip. It draws whatever WindowState says and turns clicks and
// drags into requests; it never changes the tab list itself.

import type { TabState, WindowState } from '../shared/ipc';

export interface TabStripActions {
  activate(id: number): void;
  close(id: number): void;
  move(id: number, toIndex: number): void;
  toggleMute(id: number): void;
}

const ICONS = {
  close: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  sound:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h2.5L9 3v10L5.5 10H3z"/><path d="M11 5.5a3.5 3.5 0 010 5"/></svg>',
  muted:
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6h2.5L9 3v10L5.5 10H3z"/><path d="M11 6l3 4M14 6l-3 4"/></svg>',
};

/** How far the pointer must move before a press on a tab becomes a drag. */
const DRAG_THRESHOLD = 5;

interface TabElements {
  root: HTMLElement;
  favicon: HTMLImageElement;
  title: HTMLElement;
  audio: HTMLButtonElement;
}

export function createTabStrip(container: HTMLElement, actions: TabStripActions) {
  const elements = new Map<number, TabElements>();
  let order: number[] = [];
  let activeId: number | null = null;

  function build(id: number): TabElements {
    const root = document.createElement('div');
    root.className = 'tab';
    root.setAttribute('role', 'tab');

    const icon = document.createElement('span');
    icon.className = 'icon';
    const favicon = document.createElement('img');
    favicon.alt = '';
    favicon.addEventListener('error', () => favicon.removeAttribute('src'));
    icon.append(favicon);

    const title = document.createElement('span');
    title.className = 'title';

    const audio = document.createElement('button');
    audio.type = 'button';
    audio.className = 'audio';
    audio.addEventListener('click', () => actions.toggleMute(id));

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'close';
    close.title = 'Close tab';
    close.setAttribute('aria-label', 'Close tab');
    close.innerHTML = ICONS.close;
    close.addEventListener('click', () => actions.close(id));

    root.append(icon, title, audio, close);

    // Middle-click closes. Stop the browser's own middle-click autoscroll.
    root.addEventListener('mousedown', (event) => {
      if (event.button === 1) event.preventDefault();
    });
    root.addEventListener('auxclick', (event) => {
      if (event.button === 1) actions.close(id);
    });

    root.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || (event.target as Element).closest('button')) return;
      actions.activate(id);
      startDrag(event, id, root);
    });

    return { root, favicon, title, audio };
  }

  // Drag to reorder: the tab follows the pointer; on release we work out
  // where it landed and ask the main process to move it there.
  function startDrag(down: PointerEvent, id: number, root: HTMLElement) {
    const startX = down.clientX;
    let dragging = false;
    root.setPointerCapture(down.pointerId);

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - startX;
      if (!dragging && Math.abs(dx) < DRAG_THRESHOLD) return;
      dragging = true;
      root.classList.add('dragging');
      root.style.transform = `translateX(${dx}px)`;
    };
    const onUp = () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      if (!dragging) return;
      const box = root.getBoundingClientRect();
      const center = box.left + box.width / 2;
      // The new index is the number of other tabs whose centre is left of ours.
      const toIndex = order.filter((other) => {
        if (other === id) return false;
        const rect = elements.get(other)!.root.getBoundingClientRect();
        return rect.left + rect.width / 2 < center;
      }).length;
      root.classList.remove('dragging');
      root.style.transform = '';
      actions.move(id, toIndex);
    };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);
  }

  function update(els: TabElements, tab: TabState, active: boolean) {
    const label = tab.title || tab.url || 'New tab';
    els.root.classList.toggle('active', active);
    els.root.classList.toggle('loading', tab.loading);
    els.root.setAttribute('aria-selected', String(active));
    els.root.title = label;
    els.title.textContent = label;

    const favicon = tab.favicon ?? '';
    if (els.favicon.getAttribute('src') !== favicon) {
      if (favicon) els.favicon.src = favicon;
      else els.favicon.removeAttribute('src');
    }

    const showAudio = tab.audible || tab.muted;
    els.audio.hidden = !showAudio;
    if (showAudio) {
      const label = tab.muted ? 'Unmute tab' : 'Mute tab';
      els.audio.title = label;
      els.audio.setAttribute('aria-label', label);
      els.audio.innerHTML = tab.muted ? ICONS.muted : ICONS.sound;
    }
  }

  function render(state: WindowState) {
    const previousActive = activeId;
    activeId = state.activeId;
    order = state.tabs.map((tab) => tab.id);

    for (const [id, els] of elements) {
      if (!order.includes(id)) {
        els.root.remove();
        elements.delete(id);
      }
    }
    for (const tab of state.tabs) {
      let els = elements.get(tab.id);
      if (!els) {
        els = build(tab.id);
        elements.set(tab.id, els);
      }
      update(els, tab, tab.id === activeId);
      container.append(els.root); // Moves existing elements into the new order.
    }

    if (activeId !== previousActive && activeId !== null) {
      elements.get(activeId)?.root.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  return { render };
}
