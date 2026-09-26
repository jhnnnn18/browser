// Zoom levels, the same steps Chrome uses. Pure, so it can be unit-tested.

export const ZOOM_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
] as const;

const EPSILON = 0.001;

/** The next zoom step in or out from `current` (which may be between steps). */
export function stepZoom(current: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    return ZOOM_STEPS.find((step) => step > current + EPSILON) ?? ZOOM_STEPS.at(-1)!;
  }
  return [...ZOOM_STEPS].reverse().find((step) => step < current - EPSILON) ?? ZOOM_STEPS[0];
}
