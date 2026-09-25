# Browser

A minimal web browser for Windows, macOS and Linux, built with Electron and
TypeScript. Inspired by [Search](https://github.com/driceroland/Search): one
field to search or type an address, and as little else as possible.

**Status:** early. One window, one page, the address field and keyboard
navigation. Tabs, history and ad blocking are next (see [Roadmap](#roadmap)).

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
| `npm run dev`       | Start the app with live reload of the UI             |
| `npm run build`     | Compile everything into `out/`                       |
| `npm start`         | Run the compiled app from `out/`                     |
| `npm run typecheck` | Type-check all code                                  |
| `npm test`          | Run unit tests                                       |

## Keyboard shortcuts

| Action                | Windows / Linux           | macOS    |
| --------------------- | ------------------------- | -------- |
| Focus address field   | Ctrl+L, Alt+D, F6         | Cmd+L    |
| Back / Forward        | Alt+Left / Alt+Right      | Cmd+[ / Cmd+] |
| Reload                | Ctrl+R, F5                | Cmd+R    |
| Undo edit / leave field | Esc / Esc again         | same     |

## How it's put together

An Electron app is several processes. Ours has three kinds of code:

```
┌────────────────────────────────────────────┐
│  BrowserWindow (native OS window)          │
│ ┌────────────────────────────────────────┐ │
│ │ Renderer: our UI (src/renderer)        │ │ <- the address field
│ └────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────┐ │
│ │ WebContentsView: the website           │ │ <- sandboxed, no access
│ │                                        │ │    to our code at all
│ └────────────────────────────────────────┘ │
└────────────────────────────────────────────┘
        ▲ both are controlled by ▼
   Main process (src/main): windows, views, navigation, shortcuts
```

- **Main process** (`src/main`) is Node.js. It owns the window and the page
  view, decides what URL to load, and handles keyboard shortcuts.
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
4. As the page loads, `main/window.ts` sends `nav:state` messages back, and the
   UI shows the loading bar and then the page title.

Why the website isn't simply an `<iframe>` or `<webview>` in our UI: a
separate `WebContentsView` is fully isolated from our UI and from Node, which
is what stops a malicious site from reaching your files.

## Project layout

```
src/
  main/
    index.ts        app startup, menu, permissions
    window.ts       one browser window: UI + page view + IPC handlers
    navigation.ts   "is this an address or a search?"
    shortcuts.ts    keyboard shortcut table (per platform)
  preload/
    index.ts        exposes window.browser to the UI
  renderer/
    index.html      the toolbar markup
    main.ts         toolbar behaviour
    styles.css      toolbar look, light and dark
  shared/
    ipc.ts          the UI <-> main message contract
    layout.ts       toolbar height, used by both sides
test/               unit tests (Vitest)
```

## Roadmap

1. ~~Skeleton: window, address field, navigation, shortcuts~~
2. Tabs
3. History and address-field suggestions
4. Session restore, loading tabs only when opened
5. Ad blocking
6. Hide page elements, reading mode
7. Vertical and collapsible tabs, picture-in-picture, passwords
8. Installers and auto-update for Windows, macOS and Linux
