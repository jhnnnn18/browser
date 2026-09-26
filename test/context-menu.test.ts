import { describe, expect, it } from 'vitest';
import {
  pageMenu,
  quoteForMenu,
  tabMenu,
  type ClickContext,
  type PageMenuOptions,
} from '../src/main/context-menu';

const nothing: ClickContext = {
  linkURL: '',
  srcURL: '',
  mediaType: 'none',
  selectionText: '',
  isEditable: false,
  editFlags: { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: false, canSelectAll: false },
  misspelledWord: '',
  dictionarySuggestions: [],
};
const page: PageMenuOptions = { surface: 'page', canGoBack: true, canGoForward: false, inspect: true };

/** The menu as a list of labels, with "---" for separators and "(off)" for disabled items. */
function labels(entries: ReturnType<typeof pageMenu> | ReturnType<typeof tabMenu>) {
  return entries.map((e) => (e.type === 'separator' ? '---' : e.enabled ? e.label : `${e.label} (off)`));
}

describe('pageMenu', () => {
  it('offers navigation on the page background', () => {
    expect(labels(pageMenu(nothing, page))).toEqual([
      'Back',
      'Forward (off)',
      'Reload',
      '---',
      'Save page as…',
      'View page source',
      '---',
      'Inspect',
    ]);
  });

  it('offers link actions on a link', () => {
    expect(labels(pageMenu({ ...nothing, linkURL: 'https://example.com' }, page))).toEqual([
      'Open link in new tab',
      'Open link in background tab',
      'Save link as…',
      'Copy link address',
      '---',
      'Inspect',
    ]);
  });

  it('offers both link and image actions on a linked image', () => {
    const menu = labels(
      pageMenu({ ...nothing, linkURL: 'https://a.test', srcURL: 'https://a.test/x.png', mediaType: 'image' }, page),
    );
    expect(menu).toContain('Open link in new tab');
    expect(menu).toContain('Save image as…');
    expect(menu).toContain('Copy image');
  });

  it('offers copy and search for selected text', () => {
    expect(labels(pageMenu({ ...nothing, selectionText: '  hello\n world ' }, page))).toEqual([
      'Copy',
      'Search DuckDuckGo for “hello world”',
      '---',
      'Inspect',
    ]);
  });

  it('offers editing in text fields, enabled per the edit flags', () => {
    const click = {
      ...nothing,
      isEditable: true,
      editFlags: { ...nothing.editFlags, canPaste: true, canSelectAll: true },
    };
    expect(labels(pageMenu(click, page))).toEqual([
      'Undo (off)',
      'Redo (off)',
      '---',
      'Cut (off)',
      'Copy (off)',
      'Paste',
      'Select all',
      '---',
      'Inspect',
    ]);
  });

  it('puts spelling suggestions first, at most five', () => {
    const menu = pageMenu(
      { ...nothing, isEditable: true, misspelledWord: 'teh', dictionarySuggestions: ['the', 'tea', 'ten', 'tee', 'tech', 'tel'] },
      page,
    );
    expect(labels(menu).slice(0, 7)).toEqual(['the', 'tea', 'ten', 'tee', 'tech', 'Add to dictionary', '---']);
    expect(menu[0]).toMatchObject({ command: 'replace-misspelling', arg: 'the' });
    expect(menu[5]).toMatchObject({ command: 'add-to-dictionary', arg: 'teh' });
  });

  it('says when there are no spelling suggestions', () => {
    const menu = pageMenu({ ...nothing, isEditable: true, misspelledWord: 'qzxv' }, page);
    expect(labels(menu)[0]).toBe('No spelling suggestions (off)');
  });

  it('gives our own UI only editing, and no search or navigation', () => {
    const ui: PageMenuOptions = { ...page, surface: 'ui', inspect: false };
    expect(labels(pageMenu(nothing, ui))).toEqual([]);
    expect(labels(pageMenu({ ...nothing, selectionText: 'abc' }, ui))).toEqual(['Copy']);
    expect(labels(pageMenu({ ...nothing, linkURL: 'https://x.test' }, ui))).toEqual([]);
  });
});

describe('quoteForMenu', () => {
  it('collapses whitespace and shortens long text', () => {
    expect(quoteForMenu(' a\n\tb ')).toBe('a b');
    expect(quoteForMenu('x'.repeat(40))).toBe(`${'x'.repeat(29)}…`);
    expect(quoteForMenu('x'.repeat(30))).toBe('x'.repeat(30));
  });
});

describe('tabMenu', () => {
  it('lists tab actions', () => {
    expect(labels(tabMenu({ index: 0, count: 3, muted: false, hasPage: true }))).toEqual([
      'Reload',
      'Duplicate',
      'Mute tab',
      '---',
      'Close tab',
      'Close other tabs',
      'Close tabs to the right',
    ]);
  });

  it('disables what does not apply', () => {
    const menu = labels(tabMenu({ index: 0, count: 1, muted: true, hasPage: false }));
    expect(menu).toContain('Reload (off)');
    expect(menu).toContain('Duplicate (off)');
    expect(menu).toContain('Unmute tab');
    expect(menu).toContain('Close other tabs (off)');
    expect(menu).toContain('Close tabs to the right (off)');
  });
});
