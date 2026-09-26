import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { App, startSite, waitFor } from './app';

let site: { url: string; server: Server };

beforeAll(async () => {
  site = await startSite();
});
afterAll(() => {
  site.server.close();
});

const titles = async (app: App) => (await app.tabs()).map((tab) => tab.title);
const activeTitle = async (app: App) => (await app.tabs()).find((tab) => tab.active)?.title;

describe('tabs', () => {
  let app: App;
  beforeAll(async () => {
    app = await App.launch();
  });
  afterAll(() => app.quit());

  it('starts with one empty tab and the address field focused', async () => {
    expect(await titles(app)).toEqual(['New tab']);
    expect(await app.addressFocused()).toBe(true);
  });

  it('loads a page in the current tab', async () => {
    await app.go(`${site.url}/one`);
    await waitFor('page one', async () => (await titles(app))[0] === 'Page one');
    expect(await app.address()).toBe('Page one');
  });

  it('opens a new tab at the end with Ctrl+T', async () => {
    await app.key('ctrl+t');
    await waitFor('two tabs', async () => (await app.tabs()).length === 2);
    expect(await activeTitle(app)).toBe('New tab');
    expect(await app.addressFocused()).toBe(true);
    await app.go(`${site.url}/three`);
    await waitFor('page three', async () => (await titles(app))[1] === 'Page three');
  });

  it('switches tabs with Ctrl+1, Ctrl+Tab and Ctrl+9, and only the active page is visible', async () => {
    const one = await app.tab(`${site.url}/one`);
    const three = await app.tab(`${site.url}/three`);

    await app.key('ctrl+1');
    await waitFor('tab 1 active', async () => (await activeTitle(app)) === 'Page one');
    await waitFor('page one visible', async () => (await one.eval('document.visibilityState')) === 'visible');
    expect(await three.eval('document.visibilityState')).toBe('hidden');

    await app.key('ctrl+Tab');
    await waitFor('tab 2 active', async () => (await activeTitle(app)) === 'Page three');
    await app.key('ctrl+9');
    expect(await activeTitle(app)).toBe('Page three');
    one.close();
    three.close();
  });

  it('opens target=_blank links in a new tab right after the page', async () => {
    await app.key('ctrl+1');
    const one = await app.tab(`${site.url}/one`);
    await app.click(await app.pagePoint(one, '#blank'));
    await waitFor('the link tab', async () => (await titles(app)).length === 3);
    await waitFor('page two', async () => (await titles(app))[1] === 'Page two');
    expect(await titles(app)).toEqual(['Page one', 'Page two', 'Page three']);
    expect(await activeTitle(app)).toBe('Page two');
    one.close();
  });

  it('closes the active tab with Ctrl+W and activates the tab to its right', async () => {
    await app.key('ctrl+w');
    await waitFor('tab closed', async () => (await app.tabs()).length === 2);
    expect(await titles(app)).toEqual(['Page one', 'Page three']);
    expect(await activeTitle(app)).toBe('Page three');
  });

  it('reopens the closed tab where it was with Ctrl+Shift+T', async () => {
    await app.key('ctrl+shift+t');
    await waitFor('reopened', async () => (await titles(app))[1] === 'Page two');
    expect(await titles(app)).toEqual(['Page one', 'Page two', 'Page three']);
    expect(await activeTitle(app)).toBe('Page two');
  });

  it('closes a tab with a middle-click', async () => {
    await app.click(await app.uiPoint('.tab:nth-child(2)'), 2);
    await waitFor('tab closed', async () => (await app.tabs()).length === 2);
    expect(await titles(app)).toEqual(['Page one', 'Page three']);
  });

  it('reorders tabs by dragging', async () => {
    const from = await app.uiPoint('.tab:nth-child(1)');
    const to = await app.uiPoint('.tab:nth-child(2)');
    await app.drag(from, [to[0] + 60, to[1]]);
    await waitFor('reordered', async () => (await titles(app))[0] === 'Page three');
    expect(await titles(app)).toEqual(['Page three', 'Page one']);
  });

  it('opens pop-ups as tabs that can still talk to their opener', async () => {
    await app.go(`${site.url}/opener`);
    const opener = await app.tab(`${site.url}/opener`);
    await app.click(await app.pagePoint(opener, '#open'));
    await waitFor('the pop-up tab', async () => (await titles(app)).includes('Popup'));
    // The pop-up called window.opener.postMessage(); the opener put it in its title.
    await waitFor('the opener to hear back', async () => (await titles(app)).includes('Got hello'));
    expect(await activeTitle(app)).toBe('Popup');
    opener.close();
  });

  it('shows a sound icon on tabs playing audio, and mutes them', async () => {
    await app.go(`${site.url}/sound`);
    const audioButton = '.tab.active .audio';
    await waitFor('the sound icon', () => app.ui.eval(`!document.querySelector('${audioButton}').hidden`), 10000);
    expect(await app.ui.eval(`document.querySelector('${audioButton}').title`)).toBe('Mute tab');
    await app.click(await app.uiPoint(audioButton));
    await waitFor('muted', async () =>
      (await app.ui.eval(`document.querySelector('${audioButton}').title`)) === 'Unmute tab',
    );
  });

  it('opens DevTools for the page with F12', async () => {
    await app.key('F12');
    await waitFor('DevTools', async () =>
      (await app.targets()).some((t) => t.url.startsWith('devtools://')),
    );
  });
});

describe('address bar at the bottom', () => {
  let app: App;
  beforeAll(async () => {
    app = await App.launch(['--address-bar=bottom']);
  });
  afterAll(() => app.quit());

  it('puts the address bar below the page, with tabs still on top', async () => {
    const [tabs, page, bar] = await app.ui.eval<number[]>(
      `['#tabstrip', '#page-area', '#addressbar'].map((s) => document.querySelector(s).getBoundingClientRect().top)`,
    );
    expect(tabs).toBe(0);
    expect(page).toBeLessThan(bar!);
  });

  it('lays the page out between the tab strip and the address bar', async () => {
    await app.go(`${site.url}/one`);
    const page = await app.tab(`${site.url}/one`);
    const area = await app.ui.eval<{ top: number; height: number }>(
      '(({ top, height }) => ({ top, height }))(document.querySelector("#page-area").getBoundingClientRect())',
    );
    expect(await page.eval('innerHeight')).toBe(area.height);
    page.close();
  });
});
