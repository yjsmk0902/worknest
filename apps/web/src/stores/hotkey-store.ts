import { create } from 'zustand';

interface HotkeyState {
  activeContext: string;
  contextStack: string[];

  setActiveContext: (context: string) => void;
  pushContext: (context: string) => void;
  popContext: () => void;
}

export const useHotkeyStore = create<HotkeyState>((set) => ({
  activeContext: 'global',
  contextStack: [],

  setActiveContext: (context) => set({ activeContext: context }),

  pushContext: (context) =>
    set((state) => ({
      contextStack: [...state.contextStack, state.activeContext],
      activeContext: context,
    })),

  popContext: () =>
    set((state) => {
      const stack = [...state.contextStack];
      const previous = stack.pop() ?? 'global';
      return { contextStack: stack, activeContext: previous };
    }),
}));
