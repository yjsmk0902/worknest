import { useEffect, useRef } from 'react';
import { useHotkeyStore } from '../stores/hotkey-store';

interface HotkeyOptions {
  /** Context in which this shortcut is active */
  context?: string;
  /** Whether the shortcut is enabled (default: true) */
  enabled?: boolean;
  /** Whether to call preventDefault (default: true) */
  preventDefault?: boolean;
}

const isMac =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform);

/**
 * Check if the currently focused element is an input-like element.
 * Single-key shortcuts (no modifier) are suppressed when input is focused.
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;

  if (el.getAttribute('contenteditable') === 'true') return true;
  if (el.getAttribute('role') === 'textbox') return true;

  return false;
}

/**
 * Parse a key descriptor (e.g. 'mod+k', 'shift+enter', 'f2')
 * into its parts.
 */
function parseKey(key: string): {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  mainKey: string;
} {
  const parts = key.toLowerCase().split('+');
  const mod = parts.includes('mod');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt');
  const mainKey = parts.filter((p) => p !== 'mod' && p !== 'shift' && p !== 'alt').join('+');

  return { mod, shift, alt, mainKey };
}

function matchesKey(event: KeyboardEvent, key: string): boolean {
  const { mod, shift, alt, mainKey } = parseKey(key);

  // Check modifier keys
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  if (mod !== modPressed) return false;
  if (shift !== event.shiftKey) return false;
  if (alt !== event.altKey) return false;

  // Normalize event key for comparison
  const eventKey = event.key.toLowerCase();

  // Special key mappings
  const keyMap: Record<string, string> = {
    enter: 'enter',
    escape: 'escape',
    esc: 'escape',
    arrowup: 'arrowup',
    arrowdown: 'arrowdown',
    arrowleft: 'arrowleft',
    arrowright: 'arrowright',
    ' ': 'space',
    backspace: 'backspace',
    delete: 'delete',
    tab: 'tab',
    f1: 'f1',
    f2: 'f2',
    f3: 'f3',
    f4: 'f4',
    f5: 'f5',
    f6: 'f6',
    f7: 'f7',
    f8: 'f8',
    f9: 'f9',
    f10: 'f10',
    f11: 'f11',
    f12: 'f12',
  };

  const normalizedEventKey = keyMap[eventKey] ?? eventKey;
  const normalizedMainKey = keyMap[mainKey] ?? mainKey;

  return normalizedEventKey === normalizedMainKey;
}

/**
 * Register a keyboard shortcut.
 *
 * Key format: single char ('c', 's') or combo ('mod+k', 'mod+/', 'shift+enter').
 * 'mod' = Cmd on Mac, Ctrl on Windows/Linux.
 *
 * Automatically disabled when focus is in input/textarea/contenteditable/[role="textbox"]
 * unless the shortcut uses a modifier key (mod+).
 *
 * Uses context system: only fires if activeContext matches (or context is 'global').
 */
export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {},
): void {
  const { context = 'global', enabled = true, preventDefault = true } = options;

  // Use ref for handler to avoid re-registering on every render
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const listener = (event: KeyboardEvent) => {
      // Check context
      const activeContext = useHotkeyStore.getState().activeContext;

      if (context !== 'global' && activeContext !== context) return;

      // For single-key shortcuts (no modifier), suppress when input is focused
      const { mod } = parseKey(key);
      if (!mod && isInputFocused()) return;

      // Match the key combination
      if (!matchesKey(event, key)) return;

      if (preventDefault) event.preventDefault();
      handlerRef.current(event);
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [key, context, enabled, preventDefault]);
}
