import { renderHook } from '@testing-library/react';
/**
 * useHotkey hook tests.
 *
 * Tests keyboard shortcut registration, context matching,
 * modifier key support, input suppression, and cleanup.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHotkey } from '../../src/hooks/use-hotkey';
import { useHotkeyStore } from '../../src/stores/hotkey-store';

// ── Helpers ───────────────────────────────────────────────────────────

function resetStore() {
  useHotkeyStore.setState({
    activeContext: 'global',
    contextStack: [],
  });
}

/**
 * Simulate a keydown event on document.
 */
function pressKey(
  key: string,
  options: {
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: options.ctrlKey ?? false,
    metaKey: options.metaKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
  });

  // Spy on preventDefault
  vi.spyOn(event, 'preventDefault');
  document.dispatchEvent(event);
  return event;
}

/**
 * Focus a temporary input element to simulate input focus.
 */
function focusInput(): HTMLInputElement {
  const input = document.createElement('input');
  document.body.appendChild(input);
  input.focus();
  return input;
}

function cleanupInput(input: HTMLInputElement) {
  input.blur();
  document.body.removeChild(input);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useHotkey', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    // Ensure no stale focused elements
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  it('fires handler on matching key press', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler));

    pressKey('k');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire handler on non-matching key press', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler));

    pressKey('j');

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not fire when context does not match', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler, { context: 'editor' }));

    // activeContext is 'global', shortcut context is 'editor' — should not fire
    pressKey('k');

    expect(handler).not.toHaveBeenCalled();
  });

  it('fires when context matches activeContext', () => {
    const handler = vi.fn();
    useHotkeyStore.getState().setActiveContext('editor');

    renderHook(() => useHotkey('k', handler, { context: 'editor' }));

    pressKey('k');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires handler with context 'global' regardless of activeContext", () => {
    const handler = vi.fn();
    useHotkeyStore.getState().setActiveContext('editor');

    renderHook(() => useHotkey('k', handler, { context: 'global' }));

    pressKey('k');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports modifier keys (mod+k uses ctrlKey on non-Mac)', () => {
    const handler = vi.fn();

    // The hook checks navigator.platform for Mac detection.
    // In jsdom, navigator.platform is typically not 'MacIntel',
    // so 'mod' maps to ctrlKey.
    renderHook(() => useHotkey('mod+k', handler));

    // Without modifier — should not fire
    pressKey('k');
    expect(handler).not.toHaveBeenCalled();

    // With ctrl — should fire
    pressKey('k', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports shift modifier', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('shift+enter', handler));

    // Without shift — should not fire
    pressKey('Enter');
    expect(handler).not.toHaveBeenCalled();

    // With shift — should fire
    pressKey('Enter', { shiftKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is disabled when focus is in an input element (single-key shortcut)', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler));

    const input = focusInput();

    pressKey('k');
    expect(handler).not.toHaveBeenCalled();

    cleanupInput(input);
  });

  it('still fires mod+ shortcuts when input is focused', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('mod+k', handler));

    const input = focusInput();

    pressKey('k', { ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);

    cleanupInput(input);
  });

  it('is disabled when enabled option is false', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler, { enabled: false }));

    pressKey('k');

    expect(handler).not.toHaveBeenCalled();
  });

  it('cleans up listener on unmount', () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useHotkey('k', handler));

    // Should fire before unmount
    pressKey('k');
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();

    // Should not fire after unmount
    pressKey('k');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handler updates without re-registering the listener', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const { rerender } = renderHook(({ handler }) => useHotkey('k', handler), {
      initialProps: { handler: handler1 },
    });

    pressKey('k');
    expect(handler1).toHaveBeenCalledTimes(1);

    // Update handler via rerender
    rerender({ handler: handler2 });

    pressKey('k');
    expect(handler2).toHaveBeenCalledTimes(1);
    // handler1 should not have been called again
    expect(handler1).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault by default', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler));

    const event = pressKey('k');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('does not call preventDefault when option is false', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler, { preventDefault: false }));

    const event = pressKey('k');
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('is suppressed when focus is on contenteditable element', () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler));

    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();

    pressKey('k');
    expect(handler).not.toHaveBeenCalled();

    div.blur();
    document.body.removeChild(div);
  });

  it("is suppressed when focus is on element with role='textbox'", () => {
    const handler = vi.fn();
    renderHook(() => useHotkey('k', handler));

    const div = document.createElement('div');
    div.setAttribute('role', 'textbox');
    div.setAttribute('tabindex', '0');
    document.body.appendChild(div);
    div.focus();

    pressKey('k');
    expect(handler).not.toHaveBeenCalled();

    div.blur();
    document.body.removeChild(div);
  });
});
