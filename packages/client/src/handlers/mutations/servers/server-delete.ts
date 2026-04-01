import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import {
  ServerDeleteMutationInput,
  ServerDeleteMutationOutput,
} from '@worknest/client/mutations/servers/server-delete';
import { AppService } from '@worknest/client/services/app-service';
import { isWorknestDomain } from '@worknest/core';

export class ServerDeleteMutationHandler
  implements MutationHandler<ServerDeleteMutationInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  async handleMutation(
    input: ServerDeleteMutationInput
  ): Promise<ServerDeleteMutationOutput> {
    if (isWorknestDomain(input.domain)) {
      throw new MutationError(
        MutationErrorCode.ServerDeleteForbidden,
        'Cannot delete Worknest server'
      );
    }

    await this.app.deleteServer(input.domain);

    return {
      success: true,
    };
  }
}
