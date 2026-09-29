import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { App, startSite, waitFor } from './app';

let site: { url: string; server: Server };
let app: App;

beforeAll(async () => {
  site = await startSite();
  app = await App.launch();
});
afterAll(async () => {
  await app.quit();
  site.server.close();
});

const titles = async () => (await app.tabs()).map((tab) => tab.title);
const activeTitle = async () => (await app.tabs()).find((tab) => tab.active)?.title;
const visible = (selector: string) => app.ui.eval<boolean>(`!document.querySelector('${selector}').hidden`);
const text = (selector: string) => app.ui.eval<string>(`document.querySelector('${selector}').textContent`);
/** The page's zoom, rounded: devicePixelRatio is a float (1.1 reads as 1.1000000238...). */
const zoomOf = async (page: { eval<T>(e: string): Promise<T> }) =>
  Math.round((await page.eval<number>('devicePixelRatio')) * 100) / 100;

describe('find in page', () => {
  it('opens in place of the address field with Ctrl+F', async () => {
    await app.go(`${site.url}/words`);
    await waitFor('the page', async () => (await activeTitle()) === 'Words');
    await app.key('ctrl+f');
    await waitFor('the find bar', () => visible('#findbar'));
    expect(await visible('#field')).toBe(false);
    expect(await app.ui.eval('document.activeElement.id')).toBe('find');
  });

  it('counts matches and steps through them', async () => {
    await app.ui.insertText('apple');
    await waitFor('3 matches', async () => (await text('#find-count')) === '1/3');
    await app.key('Return');
    await waitFor('the second match', async () => (await text('#find-count')) === '2/3');
    await app.key('shift+Return');
    await waitFor('back to the first', async () => (await text('#find-count')) === '1/3');
  });

  it('shows when nothing matches', async () => {
    await app.ui.insertText('zzz');
    await waitFor('no matches', async () => (await text('#find-count')) === '0/0');
    expect(await app.ui.eval('document.querySelector("#findbar").classList.contains("no-matches")')).toBe(true);
    // Back to "apple" for the next test.
    await app.ui.eval(`(() => { const f = document.querySelector('#find'); f.value = ''; })()`);
    await app.ui.insertText('apple');
    await waitFor('3 matches again', async () => (await text('#find-count')) === '1/3');
  });

  it('belongs to the tab: other tabs show their address field', async () => {
    await app.key('ctrl+t');
    await waitFor('new tab', async () => (await app.tabs()).length === 2);
    expect(await visible('#findbar')).toBe(false);
    expect(await visible('#field')).toBe(true);
    await app.key('ctrl+1');
    await waitFor('find bar back', () => visible('#findbar'));
    expect(await text('#find-count')).toBe('1/3');
    await app.key('ctrl+2');
    await app.key('ctrl+w');
  });

  it('closes with Escape and remembers the search', async () => {
    await app.key('ctrl+f');
    await app.key('Escape');
    await waitFor('find bar closed', async () => !(await visible('#findbar')));
    expect(await visible('#field')).toBe(true);
    await app.key('ctrl+f');
    await waitFor('find bar', () => visible('#findbar'));
    expect(await app.ui.eval('document.querySelector("#find").value')).toBe('apple');
    await app.key('Escape');
  });
});

describe('zoom', () => {
  it('zooms in and out with the keyboard and shows the level', async () => {
    const page = await app.tab(`${site.url}/words`);
    await app.key('ctrl+equal');
    await waitFor('110%', async () => (await zoomOf(page)) === 1.1);
    expect(await visible('#zoom')).toBe(true);
    expect(await text('#zoom')).toBe('110%');
    await app.key('ctrl+minus');
    await app.key('ctrl+minus');
    await waitFor('90%', async () => (await zoomOf(page)) === 0.9);
    expect(await text('#zoom')).toBe('90%');
    await app.key('ctrl+0');
    await waitFor('100%', async () => (await zoomOf(page)) === 1);
    expect(await visible('#zoom')).toBe(false);
    page.close();
  });

  it('zooms with Ctrl + mouse wheel', async () => {
    const page = await app.tab(`${site.url}/words`);
    await app.wheel(await app.pagePoint(page, 'p'), 'up', 'ctrl');
    await waitFor('zoomed in', async () => (await zoomOf(page)) === 1.1);
    page.close();
  });

  it('applies to every tab on the same site', async () => {
    await app.key('ctrl+t');
    await app.go(`${site.url}/one`);
    const one = await app.tab(`${site.url}/one`);
    await waitFor('same zoom as the other tab', async () => (await zoomOf(one)) === 1.1);
    await waitFor('badge', async () => (await text('#zoom')) === '110%');
    // The badge resets it for the whole site.
    await app.click(await app.uiPoint('#zoom'));
    await waitFor('reset', async () => (await zoomOf(one)) === 1);
    one.close();
    await app.key('ctrl+w');
  });
});

describe('right-click menus', () => {
  it('opens a link in a new tab from the page menu', async () => {
    await app.go(`${site.url}/one`);
    const one = await app.tab(`${site.url}/one`);
    const before = (await app.tabs()).length;
    await app.menu(await app.pagePoint(one, '#blank'), 0); // "Open link in new tab"
    await waitFor('the new tab', async () => (await app.tabs()).length === before + 1);
    await waitFor('page two', async () => (await activeTitle()) === 'Page two');
    one.close();
  });

  it('shows the page source in a new tab', async () => {
    const two = await app.tab(`${site.url}/two`);
    const before = (await app.tabs()).length;
    // Page background menu: Back, Forward, Reload, ---, Save page as…, View page source
    await app.menu(await app.pagePoint(two, 'h1'), 4, 1);
    await waitFor('the source tab', async () => (await app.tabs()).length === before + 1);
    const source = await app.tab(`view-source:${site.url}/two`);
    expect(await source.eval('document.body.innerText')).toContain('<title>Page two</title>');
    source.close();
    two.close();
    await app.key('ctrl+w');
  });

  it('duplicates a tab from the tab menu', async () => {
    const before = await titles();
    await app.menu(await app.uiPoint('.tab.active'), 1); // "Duplicate"
    await waitFor('duplicate', async () => (await app.tabs()).length === before.length + 1);
    const after = await titles();
    expect(after.filter((t) => t === 'Page two')).toHaveLength(2);
  });

  it('closes other tabs from the tab menu', async () => {
    await app.menu(await app.uiPoint('.tab.active'), 4, 1); // "Close other tabs"
    await waitFor('one tab left', async () => (await app.tabs()).length === 1);
  });
});
