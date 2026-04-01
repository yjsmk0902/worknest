import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import {
  UserRoleUpdateMutationInput,
  UserRoleUpdateMutationOutput,
} from '@worknest/client/mutations/users/user-role-update';
import { UserOutput, UserRoleUpdateInput } from '@worknest/core';

export class UserRoleUpdateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<UserRoleUpdateMutationInput>
{
  async handleMutation(
    input: UserRoleUpdateMutationInput
  ): Promise<UserRoleUpdateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    try {
      const body: UserRoleUpdateInput = {
        role: input.role,
      };

      const output = await workspace.account.client
        .patch(
          `v1/workspaces/${workspace.workspaceId}/users/${input.userId}/role`,
          {
            json: body,
          }
        )
        .json<UserOutput>();

      await workspace.users.upsert(output);

      return {
        success: true,
      };
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
