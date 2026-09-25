import { describe, expect, it } from 'vitest';
import { searchUrl, toUrl } from '../src/main/navigation';

describe('toUrl', () => {
  it('returns null for empty input', () => {
    expect(toUrl('')).toBeNull();
    expect(toUrl('   ')).toBeNull();
  });

  it('keeps full URLs as they are', () => {
    expect(toUrl('https://example.com/a?b=c')).toBe('https://example.com/a?b=c');
    expect(toUrl('http://example.com')).toBe('http://example.com');
    expect(toUrl('about:blank')).toBe('about:blank');
    expect(toUrl('file:///home/me/page.html')).toBe('file:///home/me/page.html');
  });

  it('adds https:// to things that look like domains', () => {
    expect(toUrl('example.com')).toBe('https://example.com');
    expect(toUrl('  example.com  ')).toBe('https://example.com');
    expect(toUrl('news.ycombinator.com/item?id=1')).toBe('https://news.ycombinator.com/item?id=1');
    expect(toUrl('example.co.uk:8080/path')).toBe('https://example.co.uk:8080/path');
    expect(toUrl('xn--bcher-kva.example')).toBe('https://xn--bcher-kva.example');
  });

  it('uses http:// for localhost and IP addresses', () => {
    expect(toUrl('localhost')).toBe('http://localhost');
    expect(toUrl('localhost:3000/app')).toBe('http://localhost:3000/app');
    expect(toUrl('192.168.1.1')).toBe('http://192.168.1.1');
    expect(toUrl('127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    expect(toUrl('[::1]:5173')).toBe('http://[::1]:5173');
  });

  it('searches for everything else', () => {
    expect(toUrl('weather tomorrow')).toBe(searchUrl('weather tomorrow'));
    expect(toUrl('typescript')).toBe(searchUrl('typescript'));
    expect(toUrl('3.14')).toBe(searchUrl('3.14'));
    expect(toUrl('e.g')).toBe(searchUrl('e.g'));
    expect(toUrl('what is example.com')).toBe(searchUrl('what is example.com'));
  });

  it('never loads dangerous schemes', () => {
    expect(toUrl('javascript:alert(1)')).toBe(searchUrl('javascript:alert(1)'));
    expect(toUrl('data:text/html,hi')).toBe(searchUrl('data:text/html,hi'));
  });

  it('encodes the search query', () => {
    expect(toUrl('c# & f#')).toBe('https://duckduckgo.com/?q=c%23%20%26%20f%23');
  });
});
