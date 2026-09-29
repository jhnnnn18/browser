import { describe, expect, it } from 'vitest';
import { stepZoom, ZOOM_STEPS } from '../src/main/zoom';

describe('stepZoom', () => {
  it('moves one step at a time', () => {
    expect(stepZoom(1, 'in')).toBe(1.1);
    expect(stepZoom(1.1, 'in')).toBe(1.25);
    expect(stepZoom(1, 'out')).toBe(0.9);
  });

  it('snaps to the next step from in between', () => {
    expect(stepZoom(1.05, 'in')).toBe(1.1);
    expect(stepZoom(1.05, 'out')).toBe(1);
  });

  it('copes with tiny rounding differences', () => {
    expect(stepZoom(1.1000000001, 'in')).toBe(1.25);
    expect(stepZoom(0.8999999, 'out')).toBe(0.8);
  });

  it('stops at the ends', () => {
    expect(stepZoom(ZOOM_STEPS.at(-1)!, 'in')).toBe(5);
    expect(stepZoom(ZOOM_STEPS[0], 'out')).toBe(0.25);
  });
});
