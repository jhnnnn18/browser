import { describe, expect, it } from 'vitest';
import { actionFor, type KeyInput } from '../src/main/shortcuts';

function key(k: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { type: 'keyDown', key: k, control: false, meta: false, alt: false, shift: false, ...mods };
}

describe('actionFor on Windows and Linux', () => {
  for (const platform of ['win32', 'linux'] as const) {
    const at = (input: KeyInput) => actionFor(input, platform);

    it(`${platform}: navigation shortcuts`, () => {
      expect(at(key('l', { control: true }))).toBe('focus-address');
      expect(at(key('L', { control: true }))).toBe('focus-address');
      expect(at(key('d', { alt: true }))).toBe('focus-address');
      expect(at(key('F6'))).toBe('focus-address');
      expect(at(key('ArrowLeft', { alt: true }))).toBe('back');
      expect(at(key('ArrowRight', { alt: true }))).toBe('forward');
      expect(at(key('r', { control: true }))).toBe('reload');
      expect(at(key('F5'))).toBe('reload');
    });

    it(`${platform}: tab shortcuts`, () => {
      expect(at(key('t', { control: true }))).toBe('new-tab');
      expect(at(key('w', { control: true }))).toBe('close-tab');
      expect(at(key('F4', { control: true }))).toBe('close-tab');
      expect(at(key('T', { control: true, shift: true }))).toBe('reopen-tab');
      expect(at(key('Tab', { control: true }))).toBe('next-tab');
      expect(at(key('PageDown', { control: true }))).toBe('next-tab');
      expect(at(key('Tab', { control: true, shift: true }))).toBe('previous-tab');
      expect(at(key('PageUp', { control: true }))).toBe('previous-tab');
      expect(at(key('1', { control: true }))).toBe('tab-1');
      expect(at(key('9', { control: true }))).toBe('tab-9');
    });

    it(`${platform}: DevTools`, () => {
      expect(at(key('F12'))).toBe('devtools');
      expect(at(key('I', { control: true, shift: true }))).toBe('devtools');
    });

    it(`${platform}: ignores Cmd-style and unrelated keys`, () => {
      expect(at(key('l', { meta: true }))).toBeNull();
      expect(at(key('l', { control: true, meta: true }))).toBeNull();
      expect(at(key('l'))).toBeNull();
      expect(at(key('l', { control: true, shift: true }))).toBeNull();
      expect(at(key('ArrowLeft'))).toBeNull();
      expect(at(key('Tab'))).toBeNull();
      expect(at(key('1'))).toBeNull();
    });
  }
});

describe('actionFor on macOS', () => {
  const at = (input: KeyInput) => actionFor(input, 'darwin');

  it('navigation shortcuts', () => {
    expect(at(key('l', { meta: true }))).toBe('focus-address');
    expect(at(key('[', { meta: true }))).toBe('back');
    expect(at(key(']', { meta: true }))).toBe('forward');
    expect(at(key('r', { meta: true }))).toBe('reload');
  });

  it('tab shortcuts', () => {
    expect(at(key('t', { meta: true }))).toBe('new-tab');
    expect(at(key('w', { meta: true }))).toBe('close-tab');
    expect(at(key('t', { meta: true, shift: true }))).toBe('reopen-tab');
    expect(at(key('Tab', { control: true }))).toBe('next-tab');
    expect(at(key('Tab', { control: true, shift: true }))).toBe('previous-tab');
    expect(at(key('}', { code: 'BracketRight', meta: true, shift: true }))).toBe('next-tab');
    expect(at(key('{', { code: 'BracketLeft', meta: true, shift: true }))).toBe('previous-tab');
    expect(at(key('ArrowRight', { meta: true, alt: true }))).toBe('next-tab');
    expect(at(key('ArrowLeft', { meta: true, alt: true }))).toBe('previous-tab');
    expect(at(key('3', { meta: true }))).toBe('tab-3');
  });

  it('DevTools', () => {
    expect(at(key('ˆ', { code: 'KeyI', meta: true, alt: true }))).toBe('devtools');
    expect(at(key('F12'))).toBe('devtools');
  });

  it('leaves Ctrl and text-editing keys alone', () => {
    expect(at(key('l', { control: true }))).toBeNull();
    expect(at(key('t', { control: true }))).toBeNull();
    // Cmd+Left moves the cursor to the start of a text field; it must not go back.
    expect(at(key('ArrowLeft', { meta: true }))).toBeNull();
    expect(at(key('F5'))).toBeNull();
  });
});

it('only fires on key down', () => {
  expect(actionFor({ ...key('l', { control: true }), type: 'keyUp' }, 'linux')).toBeNull();
});
