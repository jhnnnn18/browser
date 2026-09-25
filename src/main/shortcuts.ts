// Keyboard shortcuts, as a pure function so it can be unit-tested.
//
// We can't use DOM keydown listeners for these: when a web page has focus,
// its keystrokes never reach our UI. Instead the main process watches
// `before-input-event` on both the UI and the page (see window.ts).

export type Action = 'focus-address' | 'back' | 'forward' | 'reload';

/** The subset of Electron's `Input` we care about. */
export interface KeyInput {
  type: string;
  key: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
  shift: boolean;
}

export function actionFor(input: KeyInput, platform: NodeJS.Platform): Action | null {
  if (input.type !== 'keyDown') return null;

  const mac = platform === 'darwin';
  // "Mod" is Cmd on macOS and Ctrl everywhere else.
  const mod = mac ? input.meta : input.control;
  const onlyMod = mod && !input.alt && !input.shift && (mac ? !input.control : !input.meta);
  const onlyAlt = input.alt && !input.control && !input.meta && !input.shift;
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;

  if (onlyMod && key === 'l') return 'focus-address';
  if (!mac && onlyAlt && key === 'd') return 'focus-address';
  if (!mac && key === 'F6' && !mod && !input.alt) return 'focus-address';

  if (onlyMod && key === 'r') return 'reload';
  if (!mac && key === 'F5' && !mod && !input.alt) return 'reload';

  if (mac) {
    if (onlyMod && key === '[') return 'back';
    if (onlyMod && key === ']') return 'forward';
  } else {
    if (onlyAlt && key === 'ArrowLeft') return 'back';
    if (onlyAlt && key === 'ArrowRight') return 'forward';
  }

  return null;
}
