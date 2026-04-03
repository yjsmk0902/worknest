import { create } from 'zustand';
import { useHotkeyStore } from './hotkey-store';

interface UIState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

const getSavedSidebarState = (): boolean => {
  try {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  } catch {
    return false;
  }
};

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: getSavedSidebarState(),
  commandPaletteOpen: false,

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarCollapsed;
      try {
        localStorage.setItem('sidebar-collapsed', String(next));
      } catch {
        // localStorage unavailable
      }
      return { sidebarCollapsed: next };
    }),

  setSidebarCollapsed: (collapsed) => {
    try {
      localStorage.setItem('sidebar-collapsed', String(collapsed));
    } catch {
      // localStorage unavailable
    }
    set({ sidebarCollapsed: collapsed });
  },

  setCommandPaletteOpen: (open) => {
    useHotkeyStore.getState().setActiveContext(open ? 'command-palette' : 'list');
    set({ commandPaletteOpen: open });
  },
}));
