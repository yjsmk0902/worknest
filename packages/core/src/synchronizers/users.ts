import { UserStatus, WorkspaceRole } from '@worknest/core/types/workspaces';

export type SyncUsersInput = {
  type: 'users';
};

export type SyncUserData = {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  avatar: string | null;
  role: WorkspaceRole;
  customName: string | null;
  customAvatar: string | null;
  createdAt: string;
  updatedAt: string | null;
  revision: string;
  status: UserStatus;
};

declare module '@worknest/core' {
  interface SynchronizerMap {
    users: {
      input: SyncUsersInput;
      data: SyncUserData;
    };
  }
}
