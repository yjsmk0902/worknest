import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import {
  UsersCreateMutationInput,
  UsersCreateMutationOutput,
} from '@worknest/client/mutations/users/users-create';
import { UsersCreateInput, UsersCreateOutput } from '@worknest/core';

export class UsersCreateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<UsersCreateMutationInput>
{
  async handleMutation(
    input: UsersCreateMutationInput
  ): Promise<UsersCreateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    try {
      const body: UsersCreateInput = {
        users: input.users,
      };

      const output = await workspace.account.client
        .post(`v1/workspaces/${workspace.workspaceId}/users`, {
          json: body,
        })
        .json<UsersCreateOutput>();

      for (const user of output.users) {
        await workspace.users.upsert(user);
      }

      return output;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
