// Turning page titles and URLs into file names that work on every OS.

// Characters Windows doesn't allow in file names (the strictest of the three),
// plus control characters.
const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;
const MAX_LENGTH = 100;

/** A safe file name (without extension) based on `text`, e.g. a page title. */
export function safeFileName(text: string, fallback = 'page'): string {
  const cleaned = text
    .replace(/\s+/g, ' ') // before FORBIDDEN, so tabs and newlines become spaces
    .replace(FORBIDDEN, '_')
    .trim()
    // Windows ignores trailing dots and spaces, and names starting with a
    // dot are hidden elsewhere.
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, MAX_LENGTH)
    .trim();
  return cleaned || fallback;
}
