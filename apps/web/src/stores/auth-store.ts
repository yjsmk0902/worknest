import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
}

interface AuthState {
  currentUser: User | null;
  currentOrg: Organization | null;
  currentWorkspace: Workspace | null;

  setCurrentUser: (user: User | null) => void;
  setCurrentOrg: (org: Organization | null) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  currentOrg: null,
  currentWorkspace: null,

  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentOrg: (org) => set({ currentOrg: org }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  reset: () =>
    set({
      currentUser: null,
      currentOrg: null,
      currentWorkspace: null,
    }),
}));
