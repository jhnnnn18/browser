// Where everything goes in a window. The UI fills the whole window; the
// active page is laid on top of it, leaving the toolbar rows uncovered.
//
//   address bar on top        address bar at the bottom
//   ┌──────────────────┐      ┌──────────────────┐
//   │ tab strip        │      │ tab strip        │
//   │ address bar      │      ├──────────────────┤
//   ├──────────────────┤      │ page             │
//   │ page             │      ├──────────────────┤
//   └──────────────────┘      │ address bar      │
//                             └──────────────────┘

export const TAB_STRIP_HEIGHT = 36;
export const ADDRESS_BAR_HEIGHT = 44;

export type AddressBarPosition = 'top' | 'bottom';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutInput {
  /** Size of the window's content area. */
  width: number;
  height: number;
  addressBar: AddressBarPosition;
  /** A page is in HTML fullscreen (e.g. a video) and covers everything. */
  fullscreen: boolean;
}

export interface Layout {
  /** Where the active page goes. (Split view will turn this into a list.) */
  page: Rect;
}

export function computeLayout({ width, height, addressBar, fullscreen }: LayoutInput): Layout {
  if (fullscreen) return { page: { x: 0, y: 0, width, height } };

  const top = addressBar === 'top' ? TAB_STRIP_HEIGHT + ADDRESS_BAR_HEIGHT : TAB_STRIP_HEIGHT;
  const bottom = addressBar === 'bottom' ? ADDRESS_BAR_HEIGHT : 0;
  return {
    page: { x: 0, y: top, width, height: Math.max(0, height - top - bottom) },
  };
}

export function parseAddressBarPosition(value: string | undefined): AddressBarPosition {
  return value === 'bottom' ? 'bottom' : 'top';
}
