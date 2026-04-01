import { AuthMutationHandlerBase } from '@worknest/client/handlers/mutations/auth/base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import {
  EmailPasswordResetInitMutationInput,
  EmailPasswordResetInitMutationOutput,
} from '@worknest/client/mutations/auth/email-password-reset-init';
import { AppService } from '@worknest/client/services/app-service';
import {
  EmailPasswordResetInitInput,
  EmailPasswordResetInitOutput,
} from '@worknest/core';

export class EmailPasswordResetInitMutationHandler
  extends AuthMutationHandlerBase
  implements MutationHandler<EmailPasswordResetInitMutationInput>
{
  constructor(appService: AppService) {
    super(appService);
  }

  async handleMutation(
    input: EmailPasswordResetInitMutationInput
  ): Promise<EmailPasswordResetInitMutationOutput> {
    const server = this.app.getServer(input.server);

    if (!server) {
      throw new MutationError(
        MutationErrorCode.ServerNotFound,
        `Server ${input.server} was not found! Try using a different server.`
      );
    }

    try {
      const body: EmailPasswordResetInitInput = {
        email: input.email,
      };

      const response = await this.app.client
        .post(`${server.httpBaseUrl}/v1/auth/email/password-reset/init`, {
          json: body,
        })
        .json<EmailPasswordResetInitOutput>();

      return response;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
