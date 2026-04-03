import { useCallback, useState } from 'react';
import { useUIStore } from '../stores/ui-store';
import { useHotkey } from './use-hotkey';

/**
 * Register all global keyboard shortcuts.
 * Should be called once in the app layout (_app.tsx).
 */
export function useGlobalShortcuts() {
  const [shortcutsSheetOpen, setShortcutsSheetOpen] = useState(false);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  // Cmd+K: Toggle command palette
  useHotkey(
    'mod+k',
    useCallback(() => {
      setCommandPaletteOpen(!commandPaletteOpen);
    }, [setCommandPaletteOpen, commandPaletteOpen]),
    { context: 'global' },
  );

  // Cmd+/: Toggle keyboard shortcuts sheet
  useHotkey(
    'mod+/',
    useCallback(() => {
      setShortcutsSheetOpen((prev) => !prev);
    }, []),
    { context: 'global' },
  );

  // Cmd+\: Toggle sidebar
  useHotkey(
    'mod+\\',
    useCallback(() => {
      toggleSidebar();
    }, [toggleSidebar]),
    { context: 'global' },
  );

  return { shortcutsSheetOpen, setShortcutsSheetOpen };
}
