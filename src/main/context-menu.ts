// What goes in a right-click menu. Pure functions: they take a description
// of what was clicked and return a list of items; window.ts turns the list
// into a real menu and carries out the chosen command.

export type PageCommand =
  | 'replace-misspelling'
  | 'add-to-dictionary'
  | 'open-link-new-tab'
  | 'open-link-background-tab'
  | 'save-link-as'
  | 'copy-link'
  | 'open-image-new-tab'
  | 'save-image-as'
  | 'copy-image'
  | 'copy-image-address'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'select-all'
  | 'search-selection'
  | 'back'
  | 'forward'
  | 'reload'
  | 'save-page-as'
  | 'view-source'
  | 'inspect';

export type TabCommand =
  | 'reload'
  | 'duplicate'
  | 'toggle-mute'
  | 'close'
  | 'close-others'
  | 'close-right';

export type MenuEntry<C extends string> =
  | { type: 'item'; command: C; label: string; enabled: boolean; arg?: string }
  | { type: 'separator' };

/** What was right-clicked. A subset of Electron's ContextMenuParams. */
export interface ClickContext {
  linkURL: string;
  srcURL: string;
  mediaType: string;
  selectionText: string;
  isEditable: boolean;
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
  misspelledWord: string;
  dictionarySuggestions: string[];
}

export interface PageMenuOptions {
  /** A web page, or our own UI (the address field), which gets less. */
  surface: 'page' | 'ui';
  canGoBack: boolean;
  canGoForward: boolean;
  /** Offer "Inspect". Always on pages; on our UI only while developing. */
  inspect: boolean;
}

const MAX_SUGGESTIONS = 5;
const MAX_QUOTE_LENGTH = 30;

function item<C extends string>(command: C, label: string, enabled = true, arg?: string): MenuEntry<C> {
  return { type: 'item', command, label, enabled, ...(arg !== undefined && { arg }) };
}
const separator = { type: 'separator' } as const;

/** Shorten selected text for a menu label: one line, at most 30 characters. */
export function quoteForMenu(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_QUOTE_LENGTH ? `${oneLine.slice(0, MAX_QUOTE_LENGTH - 1)}…` : oneLine;
}

/** Drop separators at the start, the end, and next to each other. */
function tidy<C extends string>(entries: MenuEntry<C>[]): MenuEntry<C>[] {
  const result: MenuEntry<C>[] = [];
  for (const entry of entries) {
    if (entry.type === 'separator' && (result.length === 0 || result.at(-1)!.type === 'separator')) continue;
    result.push(entry);
  }
  if (result.at(-1)?.type === 'separator') result.pop();
  return result;
}

export function pageMenu(click: ClickContext, options: PageMenuOptions): MenuEntry<PageCommand>[] {
  const entries: MenuEntry<PageCommand>[] = [];
  const onPage = options.surface === 'page';
  const link = onPage && click.linkURL !== '';
  const image = onPage && click.mediaType === 'image' && click.srcURL !== '';
  const selection = click.selectionText.trim() !== '';

  if (click.isEditable && click.misspelledWord) {
    const suggestions = click.dictionarySuggestions.slice(0, MAX_SUGGESTIONS);
    if (suggestions.length === 0) entries.push(item('replace-misspelling', 'No spelling suggestions', false));
    for (const word of suggestions) entries.push(item('replace-misspelling', word, true, word));
    entries.push(item('add-to-dictionary', 'Add to dictionary', true, click.misspelledWord), separator);
  }

  if (link) {
    entries.push(
      item('open-link-new-tab', 'Open link in new tab'),
      item('open-link-background-tab', 'Open link in background tab'),
      item('save-link-as', 'Save link as…'),
      item('copy-link', 'Copy link address'),
      separator,
    );
  }

  if (image) {
    entries.push(
      item('open-image-new-tab', 'Open image in new tab'),
      item('save-image-as', 'Save image as…'),
      item('copy-image', 'Copy image'),
      item('copy-image-address', 'Copy image address'),
      separator,
    );
  }

  const flags = click.editFlags;
  if (click.isEditable) {
    entries.push(
      item('undo', 'Undo', flags.canUndo),
      item('redo', 'Redo', flags.canRedo),
      separator,
      item('cut', 'Cut', flags.canCut),
      item('copy', 'Copy', flags.canCopy),
      item('paste', 'Paste', flags.canPaste),
      item('select-all', 'Select all', flags.canSelectAll),
      separator,
    );
  } else if (selection) {
    entries.push(item('copy', 'Copy'));
    if (onPage) {
      entries.push(item('search-selection', `Search DuckDuckGo for “${quoteForMenu(click.selectionText)}”`));
    }
    entries.push(separator);
  }

  // Nothing specific was clicked: the page itself.
  if (onPage && !link && !image && !click.isEditable && !selection) {
    entries.push(
      item('back', 'Back', options.canGoBack),
      item('forward', 'Forward', options.canGoForward),
      item('reload', 'Reload'),
      separator,
      item('save-page-as', 'Save page as…'),
      item('view-source', 'View page source'),
      separator,
    );
  }

  if (options.inspect) entries.push(item('inspect', 'Inspect'));

  return tidy(entries);
}

export interface TabMenuOptions {
  index: number;
  count: number;
  muted: boolean;
  hasPage: boolean;
}

export function tabMenu({ index, count, muted, hasPage }: TabMenuOptions): MenuEntry<TabCommand>[] {
  return [
    item('reload', 'Reload', hasPage),
    item('duplicate', 'Duplicate', hasPage),
    item('toggle-mute', muted ? 'Unmute tab' : 'Mute tab'),
    separator,
    item('close', 'Close tab'),
    item('close-others', 'Close other tabs', count > 1),
    item('close-right', 'Close tabs to the right', index < count - 1),
  ];
}
