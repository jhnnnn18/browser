# Roadmap

A minimal, cross-platform browser (Windows first, then macOS and Linux),
inspired by [Search](https://github.com/driceroland/Search). Each step is one
pull request: designed together first, then built with unit tests,
end-to-end tests and CI.

## Phase 1: Foundation

- [x] **1. Skeleton:** window, address field, address-or-search, keyboard
  shortcuts, sandboxed pages, CI on Linux/Windows/macOS.

## Phase 2: Everyday browsing → Milestone A (daily driver)

- [ ] **2. Tabs:** open/close/switch/reorder, links and pop-ups open as tabs
  (pop-ups keep `window.opener` so "Sign in with..." works), reopen closed
  tab, mute tab, DevTools (F12), layout function with the address bar on
  top or bottom (`--address-bar=bottom` until there's a settings page),
  container field on every tab, end-to-end tests in CI.
- [ ] **3. Browser basics:** right-click menu, find in page, zoom, downloads,
  error pages.
- [ ] **4. Storage, history, suggestions:** settings and history storage,
  address-field suggestions (including "switch to open tab"), suggestions
  pop-up that opens upward when the address bar is at the bottom, saved
  address-bar position.
- [ ] **5. Session restore:** tabs come back on launch; a page only loads when
  its tab is first opened. Crash-safe saving.

At Milestone A: first test on a real Windows machine; choose a name and a
license.

## Phase 3: Privacy

- [ ] **6. VPN (Proton), on by default once set up**
  - First-run setup offers it; can be skipped.
  - Guided Proton setup: sign in at account.protonvpn.com, download a
    WireGuard configuration (available on the free plan for free servers),
    import it. Proton has no public sign-in API for other apps, so the
    browser never handles your Proton password. Any standard WireGuard
    `.conf` file works the same way.
  - A user-space WireGuard helper ([wireproxy](https://github.com/whyvl/wireproxy),
    no admin rights) exposes the tunnel as a local proxy; the browser routes
    through it with `session.setProxy()`.
  - Kill switch (on by default): if the tunnel drops, pages stop loading
    rather than using the real connection.
  - WebRTC IP-leak protection.
  - Private key stored encrypted with the OS keychain (`safeStorage`).
  - Toolbar status: connected / country / blocked.
  - Tests use a local proxy in CI; the real Proton connection is checked by
    hand.
- [ ] **7. Private windows and containers:** each with its own storage
  partition and its own route (VPN or direct). Private windows keep nothing
  after closing.
- [ ] **8. Ad blocking:** `@ghostery/adblocker-electron` with uBlock Origin's
  filter lists. Runs inside the browser, so it works in every window, private
  windows and every container. Per-site off switch.

## Phase 4: The features that make it "Search" → Milestone B

- [ ] **9. Element hiding:** pick an element, hide it on that site for good.
- [ ] **10. Reading mode** (Readability.js).
- [ ] **11. Tab layouts:** vertical, collapsible, pinned.
- [ ] **12. Split view:** two tabs side by side.
- [ ] **13. Settings page and permission prompts:** search engine, address
  bar position, VPN, camera/microphone/location prompts per site.

## Phase 5: Harder features (optional)

- [ ] **14. Passwords** (`safeStorage`), or recommend a password-manager
  extension instead.
- [ ] **15. Chrome extensions** via `electron-chrome-extensions`. Partial
  support; real uBlock Origin could be tried here, but built-in blocking
  (step 8) doesn't depend on it.

## Phase 6: Shipping → Milestone C (1.0)

- [ ] **16. Installers:** Windows (NSIS), Linux (AppImage/RPM), macOS (DMG),
  built in CI. The WireGuard helper is bundled for each platform.
- [ ] **17. Code signing:** Windows (Azure Trusted Signing), macOS (Apple
  Developer ID).
- [ ] **18. Auto-update** (`electron-updater` + GitHub Releases). Electron
  releases carry Chromium security fixes, so staying current matters.

## Decided against

- **Tor:** not included.
- **Proton's browser extension:** relies on the `chrome.proxy` API, which
  Electron doesn't support. Step 6 covers the same need.
- **uBlock Origin Lite:** needs `declarativeNetRequest`, which Electron
  doesn't support.

## Ideas for later

Commands in the address field (`> mute`), custom search keywords, HTTPS-only
mode, hiding cookie banners, clearing data on exit, per-site settings,
forced dark mode, custom CSS per site, bookmarks/reading list, importing from
Chrome/Firefox, keyboard link hints, full-page screenshots.
