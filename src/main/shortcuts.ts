// Keyboard shortcuts, as a pure function so it can be unit-tested.
//
// We can't use DOM keydown listeners for these: when a web page has focus,
// its keystrokes never reach our UI. Instead the main process watches
// `before-input-event` on the UI and on every tab (see window.ts).

type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Action =
  | 'focus-address'
  | 'back'
  | 'forward'
  | 'reload'
  | 'new-tab'
  | 'close-tab'
  | 'reopen-tab'
  | 'next-tab'
  | 'previous-tab'
  | 'devtools'
  | `tab-${Digit}`;

/** The subset of Electron's `Input` we care about. */
export interface KeyInput {
  type: string;
  key: string;
  code?: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

interface Binding {
  action: Action;
  /** Matches the key (case-insensitive for letters) or the physical key code. */
  keys: string[];
  /** Cmd on macOS, Ctrl elsewhere. */
  mod?: true;
  shift?: true;
  alt?: true;
  /** The physical Control key on macOS (where it isn't "mod"). */
  macCtrl?: true;
}

// Shortcuts that are the same everywhere apart from Cmd vs Ctrl.
const COMMON: Binding[] = [
  { action: 'focus-address', keys: ['l'], mod: true },
  { action: 'reload', keys: ['r'], mod: true },
  { action: 'new-tab', keys: ['t'], mod: true },
  { action: 'close-tab', keys: ['w'], mod: true },
  { action: 'reopen-tab', keys: ['t'], mod: true, shift: true },
  { action: 'devtools', keys: ['F12'] },
  ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map(
    (n): Binding => ({ action: `tab-${n}`, keys: [String(n)], mod: true }),
  ),
];

const WINDOWS_LINUX: Binding[] = [
  { action: 'focus-address', keys: ['d'], alt: true },
  { action: 'focus-address', keys: ['F6'] },
  { action: 'reload', keys: ['F5'] },
  { action: 'back', keys: ['ArrowLeft'], alt: true },
  { action: 'forward', keys: ['ArrowRight'], alt: true },
  { action: 'close-tab', keys: ['F4'], mod: true },
  { action: 'next-tab', keys: ['Tab', 'PageDown'], mod: true },
  { action: 'previous-tab', keys: ['Tab'], mod: true, shift: true },
  { action: 'previous-tab', keys: ['PageUp'], mod: true },
  { action: 'devtools', keys: ['i'], mod: true, shift: true },
];

const MAC: Binding[] = [
  { action: 'back', keys: ['['], mod: true },
  { action: 'forward', keys: [']'], mod: true },
  { action: 'next-tab', keys: ['Tab'], macCtrl: true },
  { action: 'previous-tab', keys: ['Tab'], macCtrl: true, shift: true },
  // Cmd+Shift+] and Cmd+Shift+[ report "}" and "{" as the key.
  { action: 'next-tab', keys: ['BracketRight'], mod: true, shift: true },
  { action: 'previous-tab', keys: ['BracketLeft'], mod: true, shift: true },
  { action: 'next-tab', keys: ['ArrowRight'], mod: true, alt: true },
  { action: 'previous-tab', keys: ['ArrowLeft'], mod: true, alt: true },
  // Option changes the character typed, so match the physical key.
  { action: 'devtools', keys: ['KeyI'], mod: true, alt: true },
];

function matches(binding: Binding, input: KeyInput, mac: boolean): boolean {
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  if (!binding.keys.some((k) => k === key || k === input.code)) return false;

  const mod = mac ? input.meta : input.control;
  const macCtrl = mac && input.control;
  const extraMeta = !mac && input.meta;
  return (
    mod === !!binding.mod &&
    input.shift === !!binding.shift &&
    input.alt === !!binding.alt &&
    macCtrl === !!binding.macCtrl &&
    !extraMeta
  );
}

export function actionFor(input: KeyInput, platform: NodeJS.Platform): Action | null {
  if (input.type !== 'keyDown') return null;
  const mac = platform === 'darwin';
  const bindings = [...COMMON, ...(mac ? MAC : WINDOWS_LINUX)];
  return bindings.find((binding) => matches(binding, input, mac))?.action ?? null;
}
