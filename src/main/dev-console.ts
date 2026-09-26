// While developing, copy console messages from our UI and from web pages to
// the terminal running `npm run dev`, so you don't need DevTools open to see
// them. Off in packaged builds; `--log-console` turns it on there too.

import { app, type WebContents } from 'electron';
import { basename } from 'node:path';

export const devConsoleEnabled = !app.isPackaged || app.commandLine.hasSwitch('log-console');

const COLORS = { error: '\x1b[31m', warning: '\x1b[33m', info: '', debug: '\x1b[2m' };
const RESET = '\x1b[0m';

/**
 * Print every console message from `contents`, prefixed with `label()`.
 * For web pages (`isPage`), Electron's development-only "Security Warning"
 * is skipped: it's about the app's own pages, and websites aren't our code.
 */
export function forwardConsole(contents: WebContents, label: () => string, { isPage = false } = {}) {
  if (!devConsoleEnabled) return;
  contents.on('console-message', ({ level, message, sourceId, lineNumber }) => {
    if (isPage && message.includes('Electron Security Warning')) return;
    // Page scripts can be long URLs; the file name and line are enough.
    const where = sourceId ? ` (${basename(sourceId.split(/[?#]/)[0]!)}:${lineNumber})` : '';
    const color = COLORS[level];
    const text = `[${label()}] ${level === 'info' ? '' : `${level}: `}${message}${where}`;
    console.log(color ? `${color}${text}${RESET}` : text);
  });
}
