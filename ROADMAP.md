# Roadmap

A lightweight, private, ad-free browser for Windows, macOS and Linux,
inspired by [Search](https://github.com/driceroland/Search): one field to
search or type an address, and as little else as possible. Each step is one
pull request: designed together first, then built with unit tests,
end-to-end tests and CI.

**What it's for:** everyday browsing that's private by default (VPN, no
tracking, private windows), free of ads, and customizable (themes, colours,
fonts). The only sign-ins it needs to support are Google and Outlook, plus a
Claude side panel.

## Phase 1: Foundation

- [x] **1. Skeleton:** window, address field, address-or-search, keyboard
  shortcuts, sandboxed pages, CI on Linux/Windows/macOS.

## Phase 2: Everyday browsing → Milestone A (daily driver)

- [ ] **2. Tabs:** open/close/switch/reorder, links and pop-ups open as tabs
  (pop-ups keep `window.opener` so "Sign in with..." works), reopen closed
  tab, mute tab, DevTools (F12), layout function with the address bar on
  top or bottom (`--address-bar=bottom` until there's a settings page),
  end-to-end tests in CI, console messages in the terminal while developing.
- [ ] **3a. Right-click menus, find in page, zoom.** Native menus for pages,
  links, images, selected text, text fields (with spelling suggestions) and
  tabs. Find replaces the address field while open, per tab. Zoom per site
  (Chromium already remembers it between restarts).
- [ ] **3b. Session setup, downloads and error pages.**
  - Session setup (from the architecture review): our UI gets its own
    session, separate from browsing; one function configures every browsing
    session the same way (permissions, downloads, certificates, and later
    the VPN and ad blocking); site icons are fetched through the tab's own
    session so the UI never makes network requests.
  - A pop-over view above the page (reused by suggestions in step 5).
  - Downloads go straight to the Downloads folder; "Save … as…" asks.
  - Friendly error pages drawn by our UI, with Try again.
  - Invalid certificates: blocked, with a "Continue anyway (unsafe)" option
    that lasts for that site's certificate until the browser closes, and a
    "Not secure" warning while on it.
- [ ] **4. Google and Outlook sign-in check.** Google often refuses sign-in
  from Electron-based browsers ("This browser or app may not be secure"),
  usually because the browser identifies itself as Electron. Check both
  sign-ins early; present a standard Chrome identification if needed.
- [ ] **5. Storage, history, suggestions:** settings and history storage,
  address-field suggestions (including "switch to open tab"), suggestions
  pop-up that opens upward when the address bar is at the bottom, saved
  address-bar position, saved downloads list.
- [ ] **6. Session restore and sleeping tabs:** tabs come back on launch; a
  page only loads when its tab is first opened; background tabs unused for
  a while are put to sleep to save memory. Crash-safe saving.

At Milestone A: first test on a real Windows machine; choose a name and a
license.

## Phase 3: Private and ad-free

- [ ] **7. Ad blocking:** `@ghostery/adblocker-electron` with uBlock Origin's
  filter lists. Runs inside the browser, so it works in every window and
  private windows. Per-site off switch.
- [ ] **8. VPN (Proton), for the whole browser, on by default once set up**
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
- [ ] **9. Private windows:** a temporary session that keeps nothing after
  the window closes, and no history. Goes through the VPN like everything
  else.

## Phase 4: Customizable → Milestone B

- [ ] **10. Settings, themes and fonts**
  - A settings page: search engine, address bar position, VPN, downloads
    location, and camera/microphone/location prompts per site.
  - Themes as small files (colours, fonts, corner roundness) applied to the
    browser's own UI, which is already built on CSS variables. Built in
    rather than Chrome theme extensions, which Electron doesn't support.
  - Default fonts for websites: the fonts pages use when they don't choose
    their own (standard, serif, sans-serif, monospace) and default sizes.
- [ ] **11. Element hiding and reading mode.** Pick an element and hide it on
  that site for good. Reading mode shows the article in its own sandboxed
  view with our own template, using the theme's fonts and colours.
- [ ] **12. Claude side panel**
  - A panel beside the page for chatting with Claude, including about the
    current page. Claude never acts on pages: no clicking, typing or
    navigating.
  - Page text is sent only when you ask, and the panel shows what is being
    sent. Uses the same article extraction as reading mode.
  - Each person uses their own Claude account, never a key built into the
    browser. How they sign in is still to be decided (see "Open questions").
  - Claude to start; other providers maybe later.
- [ ] **13. Tab layouts and split view:** vertical, collapsible and pinned
  tabs; two tabs side by side.

## Phase 5: Maybe later (planned, to be decided)

- [ ] **14. Passwords** (`safeStorage`), or recommend a password-manager
  extension instead.
- [ ] **15. Chrome extensions** via `electron-chrome-extensions`. Partial
  support; built-in ad blocking (step 7) and built-in themes (step 10) don't
  depend on it.

## Phase 6: Shipping → Milestone C (1.0)

- [ ] **16. Installers:** Windows (NSIS), Linux (AppImage/RPM), macOS (DMG),
  built in CI. The WireGuard helper is bundled for each platform.
- [ ] **17. Code signing:** Windows (Azure Trusted Signing), macOS (Apple
  Developer ID).
- [ ] **18. Auto-update** (`electron-updater` + GitHub Releases). Electron
  releases carry Chromium security fixes, so staying current matters.

## Open questions

- **How people sign in to Claude (step 12).** Anthropic's API has no
  "Sign in with Claude" for third-party desktop apps; its documented options
  are API keys, Workload Identity Federation (for servers) and App Attest
  (for iOS/macOS apps, billed to the developer). Claude.ai subscriptions
  (Pro/Max) aren't among them. Two ways to give each person their own
  account:
  - **A. Claude.ai in the panel:** the panel shows the claude.ai website and
    you sign in there as usual, using your existing subscription. No API
    key or API billing, but no automatic "ask about this page": page text
    would be copied into the chat with a button.
  - **B. Your own API key:** you create a key in the Claude Console
    (pay-as-you-go, billed separately from any Claude.ai subscription) and
    paste it in once; it's stored encrypted with the OS keychain. The panel
    is our own UI, streams answers, and can include the page automatically
    when you ask about it.

## Decided against

- **Containers** (separate logins side by side): not needed.
- **Tor:** not included.
- **Proton's browser extension:** relies on the `chrome.proxy` API, which
  Electron doesn't support. Step 8 covers the same need.
- **uBlock Origin Lite:** needs `declarativeNetRequest`, which Electron
  doesn't support.
- **Claude acting on pages:** the side panel only reads and answers.

## Ideas for later

Commands in the address field (`> mute`), custom search keywords, HTTPS-only
mode, hiding cookie banners, clearing data on exit, per-site settings,
forced dark mode, custom CSS per site, bookmarks/reading list, importing from
Chrome/Firefox, keyboard link hints, full-page screenshots, other AI
providers in the side panel.
