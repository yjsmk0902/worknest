import { createContext, useContext } from 'react';

export interface WorkspaceContextValue {
  orgId: string;
  orgSlug: string;
  orgName: string;
  wsId: string;
  wsSlug: string;
  wsName: string;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspaceContext must be used within a WorkspaceContext.Provider');
  }
  return ctx;
}
