import { describe, expect, it } from 'vitest';
import { safeFileName } from '../src/main/filenames';

describe('safeFileName', () => {
  it('keeps ordinary titles', () => {
    expect(safeFileName('Page one')).toBe('Page one');
  });

  it('replaces characters Windows forbids', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('removes control characters and squashes whitespace', () => {
    expect(safeFileName('a\u0000b\n\tc')).toBe('a_b c');
  });

  it('trims leading dots and trailing dots or spaces', () => {
    expect(safeFileName('...hidden')).toBe('hidden');
    expect(safeFileName('name. . ')).toBe('name');
  });

  it('limits the length', () => {
    expect(safeFileName('x'.repeat(300))).toHaveLength(100);
  });

  it('falls back when nothing usable is left', () => {
    expect(safeFileName('')).toBe('page');
    expect(safeFileName(' ... ')).toBe('page');
    expect(safeFileName('', 'download')).toBe('download');
  });
});
