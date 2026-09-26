import { describe, expect, it } from 'vitest';
import {
  ADDRESS_BAR_HEIGHT,
  computeLayout,
  parseAddressBarPosition,
  TAB_STRIP_HEIGHT,
} from '../src/shared/layout';

describe('computeLayout', () => {
  const size = { width: 1000, height: 700, fullscreen: false };

  it('puts the page below both rows when the address bar is on top', () => {
    const top = TAB_STRIP_HEIGHT + ADDRESS_BAR_HEIGHT;
    expect(computeLayout({ ...size, addressBar: 'top' }).page).toEqual({
      x: 0,
      y: top,
      width: 1000,
      height: 700 - top,
    });
  });

  it('puts the page between the tab strip and a bottom address bar', () => {
    expect(computeLayout({ ...size, addressBar: 'bottom' }).page).toEqual({
      x: 0,
      y: TAB_STRIP_HEIGHT,
      width: 1000,
      height: 700 - TAB_STRIP_HEIGHT - ADDRESS_BAR_HEIGHT,
    });
  });

  it('gives a fullscreen page the whole window', () => {
    for (const addressBar of ['top', 'bottom'] as const) {
      expect(computeLayout({ ...size, addressBar, fullscreen: true }).page).toEqual({
        x: 0,
        y: 0,
        width: 1000,
        height: 700,
      });
    }
  });

  it('never returns a negative height in a tiny window', () => {
    expect(computeLayout({ width: 100, height: 10, addressBar: 'top', fullscreen: false }).page.height).toBe(0);
  });
});

describe('parseAddressBarPosition', () => {
  it('only accepts "bottom" as the alternative', () => {
    expect(parseAddressBarPosition('bottom')).toBe('bottom');
    expect(parseAddressBarPosition('top')).toBe('top');
    expect(parseAddressBarPosition('')).toBe('top');
    expect(parseAddressBarPosition(undefined)).toBe('top');
    expect(parseAddressBarPosition('sideways')).toBe('top');
  });
});
