import { create } from 'zustand';

type ActiveContext =
  | 'list'
  | 'detail'
  | 'editor'
  | 'modal'
  | 'command-palette';

interface UIState {
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  activeContext: ActiveContext;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setActiveContext: (context: ActiveContext) => void;
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
  activeContext: 'list',

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

  setCommandPaletteOpen: (open) =>
    set({
      commandPaletteOpen: open,
      activeContext: open ? 'command-palette' : 'list',
    }),

  setActiveContext: (context) => set({ activeContext: context }),
}));
