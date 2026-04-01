import { Workspace } from '@worknest/client/types/workspaces';

export type WorkspaceListQueryInput = {
  type: 'workspace.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'workspace.list': {
      input: WorkspaceListQueryInput;
      output: Workspace[];
    };
  }
}
