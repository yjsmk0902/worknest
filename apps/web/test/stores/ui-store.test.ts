/**
 * UI Store tests.
 *
 * Tests the Zustand UI store's state management:
 * - sidebarCollapsed toggle and persistence
 * - commandPaletteOpen toggle with context switching
 * - activeContext changes
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '../../src/stores/ui-store';

// ── localStorage mock ─────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ── Helpers ───────────────────────────────────────────────────────────

function resetStore() {
  // Reset the Zustand store to initial state
  useUIStore.setState({
    sidebarCollapsed: false,
    commandPaletteOpen: false,
    activeContext: 'list',
  });
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useUIStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('has sidebarCollapsed set to false by default', () => {
      const state = useUIStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
    });

    it('has commandPaletteOpen set to false', () => {
      const state = useUIStore.getState();
      expect(state.commandPaletteOpen).toBe(false);
    });

    it("has activeContext set to 'list'", () => {
      const state = useUIStore.getState();
      expect(state.activeContext).toBe('list');
    });
  });

  describe('toggleSidebar', () => {
    it('toggles sidebarCollapsed from false to true', () => {
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it('toggles sidebarCollapsed from true to false', () => {
      useUIStore.setState({ sidebarCollapsed: true });
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('persists the sidebar state to localStorage', () => {
      useUIStore.getState().toggleSidebar();
      expect(localStorageMock.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
    });

    it('toggles twice back to original state', () => {
      useUIStore.getState().toggleSidebar();
      useUIStore.getState().toggleSidebar();
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith('sidebar-collapsed', 'false');
    });
  });

  describe('setSidebarCollapsed', () => {
    it('sets sidebarCollapsed to true', () => {
      useUIStore.getState().setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it('sets sidebarCollapsed to false', () => {
      useUIStore.setState({ sidebarCollapsed: true });
      useUIStore.getState().setSidebarCollapsed(false);
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('persists the value to localStorage', () => {
      useUIStore.getState().setSidebarCollapsed(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
    });
  });

  describe('setCommandPaletteOpen', () => {
    it('opens the command palette', () => {
      useUIStore.getState().setCommandPaletteOpen(true);
      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });

    it('closes the command palette', () => {
      useUIStore.setState({ commandPaletteOpen: true });
      useUIStore.getState().setCommandPaletteOpen(false);
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });

    it("sets activeContext to 'command-palette' when opening", () => {
      useUIStore.getState().setCommandPaletteOpen(true);
      expect(useUIStore.getState().activeContext).toBe('command-palette');
    });

    it("resets activeContext to 'list' when closing", () => {
      useUIStore.setState({ commandPaletteOpen: true, activeContext: 'command-palette' });
      useUIStore.getState().setCommandPaletteOpen(false);
      expect(useUIStore.getState().activeContext).toBe('list');
    });
  });

  describe('setActiveContext', () => {
    it("changes activeContext to 'detail'", () => {
      useUIStore.getState().setActiveContext('detail');
      expect(useUIStore.getState().activeContext).toBe('detail');
    });

    it("changes activeContext to 'editor'", () => {
      useUIStore.getState().setActiveContext('editor');
      expect(useUIStore.getState().activeContext).toBe('editor');
    });

    it("changes activeContext to 'modal'", () => {
      useUIStore.getState().setActiveContext('modal');
      expect(useUIStore.getState().activeContext).toBe('modal');
    });

    it("changes activeContext to 'command-palette'", () => {
      useUIStore.getState().setActiveContext('command-palette');
      expect(useUIStore.getState().activeContext).toBe('command-palette');
    });

    it("changes activeContext back to 'list'", () => {
      useUIStore.setState({ activeContext: 'editor' });
      useUIStore.getState().setActiveContext('list');
      expect(useUIStore.getState().activeContext).toBe('list');
    });
  });

  describe('edge cases', () => {
    it('handles localStorage being unavailable gracefully for toggleSidebar', () => {
      // Temporarily make setItem throw
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => useUIStore.getState().toggleSidebar()).not.toThrow();
      // State should still update
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it('handles localStorage being unavailable gracefully for setSidebarCollapsed', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage unavailable');
      });

      expect(() => useUIStore.getState().setSidebarCollapsed(true)).not.toThrow();
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it('setCommandPaletteOpen and setActiveContext are independent', () => {
      // Manually set activeContext to 'editor'
      useUIStore.getState().setActiveContext('editor');
      expect(useUIStore.getState().activeContext).toBe('editor');

      // Opening command palette overrides the context
      useUIStore.getState().setCommandPaletteOpen(true);
      expect(useUIStore.getState().activeContext).toBe('command-palette');

      // Closing resets to 'list', not back to 'editor'
      useUIStore.getState().setCommandPaletteOpen(false);
      expect(useUIStore.getState().activeContext).toBe('list');
    });
  });
});
