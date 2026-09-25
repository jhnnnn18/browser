// Turns whatever was typed into the address field into a URL to load.

export const SEARCH_URL = 'https://duckduckgo.com/?q=';

const ALLOWED_SCHEMES = /^(https?|file|about):/i;
const LOCAL_HOST = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:.]+\])(:\d+)?([/?#].*)?$/i;

export function searchUrl(query: string): string {
  return SEARCH_URL + encodeURIComponent(query);
}

/**
 * Decide whether `input` is an address or a search.
 * Returns null for empty input.
 *
 *   "https://example.com"  -> unchanged
 *   "example.com/path"     -> "https://example.com/path"
 *   "localhost:3000"       -> "http://localhost:3000"
 *   "weather tomorrow"     -> DuckDuckGo search
 */
export function toUrl(input: string): string | null {
  const text = input.trim();
  if (text === '') return null;

  // Anything with whitespace is a search, even if it contains a dot.
  if (/\s/.test(text)) return searchUrl(text);

  if (ALLOWED_SCHEMES.test(text)) {
    return URL.canParse(text) ? text : searchUrl(text);
  }

  // Local development servers and IP addresses usually don't speak HTTPS.
  if (LOCAL_HOST.test(text)) return `http://${text}`;

  // Looks like a domain: needs a dot, and the last label must be letters
  // (a TLD) or punycode. "example.com" passes, "e.g" and "3.14" don't.
  // A public-suffix list would be more precise; this is good enough for now.
  if (!URL.canParse(`https://${text}`)) return searchUrl(text);
  const { hostname } = new URL(`https://${text}`);
  const labels = hostname.split('.');
  const tld = labels.at(-1) ?? '';
  if (labels.length >= 2 && labels.every(Boolean) && /^([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(tld)) {
    return `https://${text}`;
  }

  return searchUrl(text);
}
