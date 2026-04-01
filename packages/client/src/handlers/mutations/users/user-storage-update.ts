import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import {
  UserStorageUpdateMutationInput,
  UserStorageUpdateMutationOutput,
} from '@worknest/client/mutations/users/user-storage-update';
import { UserOutput, UserStorageUpdateInput } from '@worknest/core';

export class UserStorageUpdateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<UserStorageUpdateMutationInput>
{
  async handleMutation(
    input: UserStorageUpdateMutationInput
  ): Promise<UserStorageUpdateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    try {
      const body: UserStorageUpdateInput = {
        storageLimit: input.storageLimit,
        maxFileSize: input.maxFileSize,
      };

      const output = await workspace.account.client
        .patch(
          `v1/workspaces/${workspace.workspaceId}/users/${input.userId}/storage`,
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
