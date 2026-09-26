# Browser

A minimal web browser for Windows, macOS and Linux, built with Electron and
TypeScript. Inspired by [Search](https://github.com/driceroland/Search): one
field to search or type an address, and as little else as possible.

**Status:** early. Tabs, the address field and keyboard navigation work.
History, a built-in VPN and ad blocking are next; see [ROADMAP.md](ROADMAP.md).

## Running it

You need Node.js 22.12 or newer and Git. Then:

```sh
npm install
npm run dev
```

### On Fedora without admin rights (Toolbx)

[Toolbx](https://containertoolbx.org) comes with Fedora Workstation. It gives
you a container where you *do* have `sudo`, shares your home folder, and shows
app windows on your normal desktop.

```sh
toolbox create browser-dev
toolbox enter browser-dev
sudo dnf install -y nodejs git        # inside the toolbox only
git clone https://github.com/jhnnnn18/browser.git
cd browser
npm install
npm run dev
```

The project lives in your home folder, so an editor running outside the
toolbox can open it. Run `npm` commands inside the toolbox.

If no window appears and the terminal says `error while loading shared
libraries`, the toolbox is missing libraries Chromium needs. Inside the
toolbox:

```sh
sudo dnf install -y nss atk at-spi2-atk cups-libs gtk3 libdrm mesa-libgbm \
  alsa-lib libxkbcommon libXcomposite libXdamage libXrandr libXScrnSaver pango
```

`http://localhost:5173` is only the dev server feeding the toolbar UI to the
app window; opening it in a normal browser won't give you a working browser.

If Toolbx isn't available, install Node into your home folder instead with
[fnm](https://github.com/Schniz/fnm) (`fnm install --lts`). Nothing in this
project needs root.

## Scripts

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the app; reloads on every saved change         |
| `npm run build`     | Compile everything into `out/`                       |
| `npm start`         | Run the compiled app from `out/`                     |
| `npm run typecheck` | Type-check all code                                  |
| `npm test`          | Run unit tests                                       |
| `npm run test:e2e`  | Build, launch the real app and drive it (see below)  |

To try the address bar at the bottom: `npm run dev -- -- --address-bar=bottom`.

While `npm run dev` runs:

- Saving a file in `src/renderer/` reloads the UI in place (the tab strip
  and address bar); saving one in `src/main/`, `src/preload/` or
  `src/shared/` rebuilds and restarts the whole app, so open tabs are lost.
- `console.log` messages (and warnings and errors) from our UI and from web
  pages are printed in the terminal, labelled `[ui]` or `[tab 3 example.com]`.
  Main-process logs appear there too, unlabelled.

## Keyboard shortcuts

| Action                  | Windows / Linux                  | macOS                          |
| ----------------------- | -------------------------------- | ------------------------------ |
| Focus address field     | Ctrl+L, Alt+D, F6                | Cmd+L                          |
| Back / Forward          | Alt+Left / Alt+Right             | Cmd+[ / Cmd+]                  |
| Reload                  | Ctrl+R, F5                       | Cmd+R                          |
| New tab                 | Ctrl+T                           | Cmd+T                          |
| Close tab               | Ctrl+W, Ctrl+F4, middle-click    | Cmd+W, middle-click            |
| Reopen closed tab       | Ctrl+Shift+T                     | Cmd+Shift+T                    |
| Next / previous tab     | Ctrl+Tab / Ctrl+Shift+Tab, Ctrl+PgDn / Ctrl+PgUp | Ctrl+Tab / Ctrl+Shift+Tab, Cmd+Shift+] / [, Cmd+Opt+→ / ← |
| Go to tab 1–8 / last    | Ctrl+1…8 / Ctrl+9                | Cmd+1…8 / Cmd+9                |
| DevTools for the page   | F12, Ctrl+Shift+I                | Cmd+Opt+I                      |
| Undo edit / leave field | Esc / Esc again                  | same                           |

## How it's put together

An Electron app is several processes. Ours has three kinds of code:

```
┌────────────────────────────────────────────┐
│  BrowserWindow (native OS window)          │
│ ┌────────────────────────────────────────┐ │
│ │ Renderer: our UI (src/renderer)        │ │ <- tab strip + address
│ └────────────────────────────────────────┘ │    field; fills the window
│ ┌────────────────────────────────────────┐ │
│ │ WebContentsView: the active tab        │ │ <- one per tab, sandboxed,
│ │                                        │ │    no access to our code
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
        ▲ both are controlled by ▼
   Main process (src/main): windows, views, navigation, shortcuts
```

- **Main process** (`src/main`) is Node.js. It owns the window and the list
  of tabs, decides what URL to load, and handles keyboard shortcuts.
- **Renderer** (`src/renderer`) is our UI, a normal web page written in plain
  TypeScript. It can't touch Node or the website.
- **Preload** (`src/preload`) is the bridge. It gives the UI a
  `window.browser` object with a handful of functions, and nothing else.
- **Shared** (`src/shared`) holds the message contract (`ipc.ts`) both sides
  agree on.

A typical round trip, typing `example.com` and pressing Enter:

1. `renderer/main.ts` calls `window.browser.navigate('example.com')`.
2. `preload/index.ts` sends that over IPC as `nav:navigate`.
3. `main/window.ts` receives it, `main/navigation.ts` turns it into
   `https://example.com`, and the page view loads it.
4. As the page loads, `main/window.ts` sends `window:state` messages back, and
   the UI shows the loading bar and then the page title.

**The main process owns the tab list; the UI only draws it.** Whenever
anything changes, main sends a complete `WindowState` (every tab, which one
is active). The UI redraws from it and never keeps its own copy, so the two
can't drift apart. Clicking × on a tab sends `tabs:close` with the tab's id;
main closes it and sends the new state. An id that no longer exists (a tab
closed a moment ago) is simply ignored.

Each tab has its own page view. Only the active one is visible; the others
stay attached but hidden and keep running (audio keeps playing).

Why the website isn't simply an `<iframe>` or `<webview>` in our UI: a
separate `WebContentsView` is fully isolated from our UI and from Node, which
is what stops a malicious site from reaching your files.

## Project layout

```
src/
  main/
    index.ts        app startup, menu, permissions
    window.ts       one browser window: the tab list, layout, IPC handlers
    tab.ts          one tab: its page view and the state the UI needs
    tab-list.ts     rules: where new tabs go, which tab is next, reordering
    navigation.ts   "is this an address or a search?"
    dev-console.ts  prints UI and page console messages in the terminal
    shortcuts.ts    keyboard shortcut table (per platform)
  preload/
    index.ts        exposes window.browser to the UI
  renderer/
    index.html      tab strip + address bar markup
    main.ts         address field behaviour, wiring
    tabs.ts         tab strip: drawing, clicks, drag to reorder
    styles.css      look, light and dark, address bar top or bottom
  shared/
    ipc.ts          the UI <-> main message contract
    layout.ts       where the page goes (address bar top or bottom)
test/               unit tests (Vitest)
e2e/                end-to-end tests that launch the real app
```

## End-to-end tests

`npm run test:e2e` launches the built app and drives it with real key
presses and mouse clicks, checking what's on screen through the Chrome
DevTools Protocol. It needs an X11 display and `xdotool`, so it runs on
Linux, in CI or locally under a virtual display. On Fedora, in the toolbox:

```sh
sudo dnf install -y xorg-x11-server-Xvfb xdotool
xvfb-run -a npm run test:e2e
```

## Roadmap

See [ROADMAP.md](ROADMAP.md).
