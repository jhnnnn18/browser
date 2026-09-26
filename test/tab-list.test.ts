import { describe, expect, it } from 'vitest';
import {
  cycleIndex,
  indexForNumber,
  insertionIndex,
  moveItem,
  nextActiveIndex,
  type TabPosition,
} from '../src/main/tab-list';

const tab = (id: number, openerId: number | null = null): TabPosition => ({ id, openerId });

describe('insertionIndex', () => {
  it('puts new tabs without an opener at the end', () => {
    expect(insertionIndex([], null)).toBe(0);
    expect(insertionIndex([tab(1), tab(2)], null)).toBe(2);
  });

  it('puts a tab opened from a link right after its opener', () => {
    expect(insertionIndex([tab(1), tab(2), tab(3)], 1)).toBe(1);
  });

  it('keeps several links from the same page in the order they were opened', () => {
    const tabs = [tab(1), tab(4, 1), tab(5, 1), tab(2)];
    expect(insertionIndex(tabs, 1)).toBe(3);
  });

  it('falls back to the end if the opener is gone', () => {
    expect(insertionIndex([tab(1), tab(2)], 99)).toBe(2);
  });
});

describe('nextActiveIndex', () => {
  it('activates the tab to the right', () => {
    // [A, B, C] close B (index 1) -> [A, C], C is now index 1
    expect(nextActiveIndex(1, 2)).toBe(1);
  });

  it('activates the new last tab when the last one closes', () => {
    // [A, B, C] close C (index 2) -> [A, B]
    expect(nextActiveIndex(2, 2)).toBe(1);
  });

  it('returns -1 when no tabs are left', () => {
    expect(nextActiveIndex(0, 0)).toBe(-1);
  });
});

describe('moveItem', () => {
  it('moves forwards and backwards', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('clamps out-of-range targets and ignores bad sources', () => {
    expect(moveItem(['a', 'b'], 0, 99)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('does not change the original array', () => {
    const items = ['a', 'b'];
    moveItem(items, 0, 1);
    expect(items).toEqual(['a', 'b']);
  });
});

describe('indexForNumber', () => {
  it('maps 1-8 to tabs and 9 to the last tab', () => {
    expect(indexForNumber(1, 5)).toBe(0);
    expect(indexForNumber(5, 5)).toBe(4);
    expect(indexForNumber(9, 5)).toBe(4);
    expect(indexForNumber(9, 20)).toBe(19);
  });

  it('ignores numbers past the last tab', () => {
    expect(indexForNumber(6, 5)).toBe(-1);
    expect(indexForNumber(1, 0)).toBe(-1);
  });
});

describe('cycleIndex', () => {
  it('wraps around both ends', () => {
    expect(cycleIndex(2, 1, 3)).toBe(0);
    expect(cycleIndex(0, -1, 3)).toBe(2);
    expect(cycleIndex(1, 1, 3)).toBe(2);
  });
});
