// A small harness that launches the real app and drives it like a person:
// real key presses and mouse clicks (via xdotool, so X11/Xvfb only), and the
// Chrome DevTools Protocol to read what's on screen.
//
// Why not Playwright? Its Electron launcher hangs on this Electron version,
// and keys it sends through DevTools bypass `before-input-event`, which is
// exactly what our shortcuts rely on.

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const ELECTRON = join(ROOT, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Poll until `check` returns something truthy, or fail with `what`. */
export async function waitFor<T>(
  what: string,
  check: () => Promise<T> | T,
  timeout = 5000,
): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeout;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      last = await check();
      if (last) return last as NonNullable<T>;
    } catch (error) {
      last = error;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${what} (last value: ${JSON.stringify(last)})`);
}

/** A connection to one page (our UI, or a tab) over the DevTools protocol. */
export class Page {
  private nextId = 0;
  private pending = new Map<number, (result: any) => void>();

  private constructor(private ws: WebSocket) {
    ws.onmessage = (message) => {
      const data = JSON.parse(String(message.data));
      this.pending.get(data.id)?.(data);
      this.pending.delete(data.id);
    };
  }

  static async connect(url: string): Promise<Page> {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    return new Page(ws);
  }

  send(method: string, params: object = {}): Promise<any> {
    const id = ++this.nextId;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Evaluate an expression in the page and return its (JSON) value. */
  async eval<T = unknown>(expression: string): Promise<T> {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.result?.exceptionDetails) {
      throw new Error(response.result.exceptionDetails.exception?.description ?? 'evaluation failed');
    }
    return response.result?.result?.value as T;
  }

  /** Type text into whatever has focus (not a key press; no shortcuts fire). */
  insertText(text: string) {
    return this.send('Input.insertText', { text });
  }

  close() {
    this.ws.close();
  }
}

interface Target {
  url: string;
  type: string;
  webSocketDebuggerUrl: string;
}

export interface TabInfo {
  title: string;
  active: boolean;
}

/** A local web server with the test pages. */
export async function startSite(): Promise<{ url: string; server: Server }> {
  const pages: Record<string, string> = {
    '/one': '<title>Page one</title><h1>One</h1><a id="blank" href="/two" target="_blank">two</a>',
    '/two': '<title>Page two</title><h1>Two</h1>',
    '/three': '<title>Page three</title><h1>Three</h1>',
    // A pop-up that talks back to the page that opened it, like a login pop-up.
    '/opener': `<title>Opener</title>
      <button id="open" style="font-size:30px">Sign in</button>
      <script>
        document.getElementById('open').onclick = () => window.open('/popup', 'login', 'width=400,height=400');
        addEventListener('message', (e) => { document.title = 'Got ' + e.data; });
      </script>`,
    '/popup': `<title>Popup</title><script>window.opener.postMessage('hello', '*');</script>`,
    '/words': '<title>Words</title><p>apple banana apple cherry apple</p>',
    // Plays a quiet tone so the tab counts as "playing sound".
    '/sound': `<title>Sound</title><script>
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.01;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
      </script>`,
  };
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(pages[req.url ?? ''] ?? '<title>Not found</title>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server };
}

export class App {
  ui!: Page;
  private constructor(
    private process: ChildProcess,
    private port: number,
    private profile: string,
  ) {}

  static async launch(args: string[] = []): Promise<App> {
    const port = 9400 + Math.floor(Math.random() * 500);
    // A fresh profile every time: Chromium remembers things like zoom per
    // site, which would otherwise leak from one test run into the next.
    const profile = mkdtempSync(join(tmpdir(), 'browser-e2e-'));
    // Chromium refuses to run as root without this; normal users don't need it.
    const sandbox = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
    const child = spawn(
      ELECTRON,
      [...sandbox, `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, ROOT, ...args],
      { stdio: 'ignore', env: { ...process.env, ELECTRON_RENDERER_URL: '' } },
    );
    const app = new App(child, port, profile);
    const target = await waitFor('the UI to load', async () => {
      const targets = await app.targets();
      return targets.find((t) => t.url.includes('renderer/index.html'));
    }, 15000);
    app.ui = await Page.connect(target.webSocketDebuggerUrl);
    await waitFor('the UI to render', () => app.ui.eval('!!document.querySelector(".tab")'));
    // The window only appears after its first paint, which can take a while
    // on a machine without a GPU (like CI). Real key presses sent before then
    // go nowhere, and the page itself can't tell (it reports "visible" and
    // "focused" early), so ask the X server whether the window is on screen,
    // then give it keyboard focus.
    const windowId = await waitFor(
      'the window to appear on screen',
      () => xdotoolOutput('search', '--onlyvisible', '--pid', String(child.pid)).split('\n')[0],
      15000,
    );
    xdotool('windowfocus', '--sync', windowId);
    // Keep the pointer over our window, away from any other window.
    const [x, y] = await app.ui.eval<[number, number]>('[screenX + 300, screenY + 200]');
    xdotool('mousemove', String(x), String(y));
    return app;
  }

  async targets(): Promise<Target[]> {
    const response = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    return (await response.json()) as Target[];
  }

  /** Connect to the tab showing a URL. */
  async tab(url: string): Promise<Page> {
    const target = await waitFor(`a tab at ${url}`, async () =>
      (await this.targets()).find((t) => t.url === url),
    );
    return Page.connect(target.webSocketDebuggerUrl);
  }

  /** The tab strip as the user sees it. */
  tabs(): Promise<TabInfo[]> {
    return this.ui.eval(`[...document.querySelectorAll('.tab')].map((el) => ({
      title: el.querySelector('.title').textContent,
      active: el.classList.contains('active'),
    }))`);
  }

  address(): Promise<string> {
    return this.ui.eval('document.querySelector("#address").value');
  }

  addressFocused(): Promise<boolean> {
    return this.ui.eval('document.activeElement?.id === "address"');
  }

  /** Press a real key combination, e.g. "ctrl+t". */
  async key(combo: string) {
    xdotool('key', '--clearmodifiers', combo);
    await sleep(150);
  }

  /** Type into the address field and press Enter. */
  async go(text: string) {
    await this.key('ctrl+l');
    await this.ui.insertText(text);
    await this.key('Return');
  }

  /** Screen position of the centre of an element in the UI. */
  async uiPoint(selector: string): Promise<[number, number]> {
    return this.ui.eval(`(() => {
      const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return [Math.round(screenX + r.x + r.width / 2), Math.round(screenY + r.y + r.height / 2)];
    })()`);
  }

  /** Screen position of an element inside a tab's page. */
  async pagePoint(page: Page, selector: string): Promise<[number, number]> {
    const [left, top] = await this.ui.eval<[number, number]>(
      '[screenX, screenY + document.querySelector("#page-area").getBoundingClientRect().y]',
    );
    return page.eval(`(() => {
      const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return [Math.round(${left} + r.x + r.width / 2), Math.round(${top} + r.y + r.height / 2)];
    })()`);
  }

  async click([x, y]: [number, number], button = 1) {
    xdotool('mousemove', String(x), String(y), 'click', String(button));
    await sleep(150);
  }

  /** Scroll the mouse wheel over a point while holding a key, e.g. ctrl. */
  async wheel([x, y]: [number, number], direction: 'up' | 'down', holding?: string) {
    xdotool('mousemove', String(x), String(y));
    if (holding) xdotool('keydown', holding);
    xdotool('click', direction === 'up' ? '4' : '5');
    if (holding) xdotool('keyup', holding);
    await sleep(200);
  }

  /**
   * Right-click a point, then click a menu item: `row` counts items from the
   * top (starting at 0), `separatorsAbove` how many separators come before it.
   */
  async menu(point: [number, number], row: number, separatorsAbove = 0) {
    const before = visibleWindows();
    await this.click(point, 3);
    // The native menu is its own window; ask X where it opened.
    const menu = await waitFor('the menu to open', () => visibleWindows().find((w) => !before.includes(w)));
    const geometry = xdotoolOutput('getwindowgeometry', '--shell', menu);
    const left = Number(/X=(\d+)/.exec(geometry)![1]);
    const top = Number(/Y=(\d+)/.exec(geometry)![1]);
    // Chromium's Linux menus: 3px padding, 29px items, 19px separators.
    // (Its menus ignore keys sent to them without a window manager, so the
    // item is clicked instead of chosen with the arrow keys.)
    const y = top + 3 + row * 29 + separatorsAbove * 19 + 14;
    await this.click([left + 40, y]);
  }

  async drag(from: [number, number], to: [number, number]) {
    xdotool('mousemove', String(from[0]), String(from[1]), 'mousedown', '1');
    for (let step = 1; step <= 5; step++) {
      const x = from[0] + ((to[0] - from[0]) * step) / 5;
      xdotool('mousemove', String(Math.round(x)), String(to[1]));
      await sleep(30);
    }
    xdotool('mouseup', '1');
    await sleep(200);
  }

  async quit() {
    this.ui?.close();
    this.process.kill();
    await new Promise((resolve) => this.process.once('exit', resolve));
    rmSync(this.profile, { recursive: true, force: true });
  }
}

function xdotool(...args: string[]) {
  execFileSync('xdotool', args);
}

function visibleWindows(): string[] {
  return xdotoolOutput('search', '--onlyvisible', '--name', '').split('\n').filter(Boolean);
}

/** Run xdotool and return what it printed ('' if it found nothing). */
function xdotoolOutput(...args: string[]): string {
  try {
    return execFileSync('xdotool', args, { encoding: 'utf8' }).trim();
  } catch {
    return ''; // `search` exits with an error when nothing matches.
  }
}
