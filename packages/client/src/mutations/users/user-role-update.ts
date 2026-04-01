import { WorkspaceRole } from '@worknest/core';

export type UserRoleUpdateMutationInput = {
  type: 'user.role.update';
  userId: string;
  role: WorkspaceRole;
};

export type UserRoleUpdateMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'user.role.update': {
      input: UserRoleUpdateMutationInput;
      output: UserRoleUpdateMutationOutput;
    };
  }
}
