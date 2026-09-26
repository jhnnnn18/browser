// Rules for where tabs go and which tab becomes active. Plain functions over
// arrays, with no Electron, so they can be unit-tested.

export interface TabPosition {
  id: number;
  /** The tab this one was opened from (a link or pop-up), if any. */
  openerId: number | null;
}

/**
 * Where to insert a new tab.
 * Ctrl+T tabs go at the end. Tabs opened from a link go right after the tab
 * that opened them, after any siblings it already opened, so opening several
 * links in a row keeps them in order next to their source.
 */
export function insertionIndex(tabs: readonly TabPosition[], openerId: number | null): number {
  if (openerId === null) return tabs.length;
  const openerIndex = tabs.findIndex((tab) => tab.id === openerId);
  if (openerIndex === -1) return tabs.length;
  let index = openerIndex + 1;
  while (index < tabs.length && tabs[index]!.openerId === openerId) index++;
  return index;
}

/**
 * After removing the tab at `closedIndex` from a list that now has
 * `remaining` tabs, which index should become active?
 * The tab that was to the right (which has now slid into `closedIndex`),
 * or the new last tab if the closed one was last. -1 if nothing is left.
 */
export function nextActiveIndex(closedIndex: number, remaining: number): number {
  if (remaining === 0) return -1;
  return Math.min(closedIndex, remaining - 1);
}

/** Return a copy of `items` with the item at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (from < 0 || from >= result.length) return result;
  const [item] = result.splice(from, 1);
  const target = Math.max(0, Math.min(to, result.length));
  result.splice(target, 0, item!);
  return result;
}

/** Ctrl/Cmd+1..8 pick that tab; 9 always picks the last tab. */
export function indexForNumber(n: number, count: number): number {
  if (count === 0) return -1;
  if (n === 9) return count - 1;
  return n >= 1 && n <= count ? n - 1 : -1;
}

/** Next or previous tab, wrapping around at either end. */
export function cycleIndex(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1;
  return (current + delta + count) % count;
}
