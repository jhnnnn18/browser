import { describe, expect, it } from 'vitest';
import { actionFor, type KeyInput } from '../src/main/shortcuts';

function key(k: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { type: 'keyDown', key: k, control: false, meta: false, alt: false, shift: false, ...mods };
}

describe('actionFor on Windows and Linux', () => {
  for (const platform of ['win32', 'linux'] as const) {
    it(`${platform}: maps the standard shortcuts`, () => {
      expect(actionFor(key('l', { control: true }), platform)).toBe('focus-address');
      expect(actionFor(key('L', { control: true }), platform)).toBe('focus-address');
      expect(actionFor(key('d', { alt: true }), platform)).toBe('focus-address');
      expect(actionFor(key('F6'), platform)).toBe('focus-address');
      expect(actionFor(key('ArrowLeft', { alt: true }), platform)).toBe('back');
      expect(actionFor(key('ArrowRight', { alt: true }), platform)).toBe('forward');
      expect(actionFor(key('r', { control: true }), platform)).toBe('reload');
      expect(actionFor(key('F5'), platform)).toBe('reload');
    });

    it(`${platform}: ignores Cmd-style and unrelated keys`, () => {
      expect(actionFor(key('l', { meta: true }), platform)).toBeNull();
      expect(actionFor(key('l'), platform)).toBeNull();
      expect(actionFor(key('l', { control: true, shift: true }), platform)).toBeNull();
      expect(actionFor(key('ArrowLeft'), platform)).toBeNull();
    });
  }
});

describe('actionFor on macOS', () => {
  it('maps the standard shortcuts', () => {
    expect(actionFor(key('l', { meta: true }), 'darwin')).toBe('focus-address');
    expect(actionFor(key('[', { meta: true }), 'darwin')).toBe('back');
    expect(actionFor(key(']', { meta: true }), 'darwin')).toBe('forward');
    expect(actionFor(key('r', { meta: true }), 'darwin')).toBe('reload');
  });

  it('leaves Ctrl and text-editing keys alone', () => {
    expect(actionFor(key('l', { control: true }), 'darwin')).toBeNull();
    // Cmd+Left moves the cursor to the start of a text field; it must not go back.
    expect(actionFor(key('ArrowLeft', { meta: true }), 'darwin')).toBeNull();
    expect(actionFor(key('F5'), 'darwin')).toBeNull();
  });
});

it('only fires on key down', () => {
  expect(actionFor({ ...key('l', { control: true }), type: 'keyUp' }, 'linux')).toBeNull();
});
