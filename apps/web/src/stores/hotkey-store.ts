import { create } from 'zustand';

export type ActiveContext =
  | 'global'
  | 'list'
  | 'detail'
  | 'board'
  | 'editor'
  | 'modal'
  | 'command-palette';

interface HotkeyState {
  activeContext: ActiveContext;
  contextStack: ActiveContext[];

  setActiveContext: (context: ActiveContext) => void;
  pushContext: (context: ActiveContext) => void;
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
