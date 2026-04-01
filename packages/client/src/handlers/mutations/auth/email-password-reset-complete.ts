import { AuthMutationHandlerBase } from '@worknest/client/handlers/mutations/auth/base';
import { MutationHandler } from '@worknest/client/lib';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import {
  EmailPasswordResetCompleteMutationInput,
  EmailPasswordResetCompleteMutationOutput,
} from '@worknest/client/mutations/auth/email-password-reset-complete';
import { AppService } from '@worknest/client/services/app-service';
import {
  EmailPasswordResetCompleteInput,
  EmailPasswordResetCompleteOutput,
} from '@worknest/core';

export class EmailPasswordResetCompleteMutationHandler
  extends AuthMutationHandlerBase
  implements MutationHandler<EmailPasswordResetCompleteMutationInput>
{
  constructor(appService: AppService) {
    super(appService);
  }

  async handleMutation(
    input: EmailPasswordResetCompleteMutationInput
  ): Promise<EmailPasswordResetCompleteMutationOutput> {
    const server = this.app.getServer(input.server);

    if (!server) {
      throw new MutationError(
        MutationErrorCode.ServerNotFound,
        `Server ${input.server} was not found! Try using a different server.`
      );
    }

    try {
      const body: EmailPasswordResetCompleteInput = {
        id: input.id,
        otp: input.otp,
        password: input.password,
      };

      const response = await this.app.client
        .post(`${server.httpBaseUrl}/v1/auth/email/password-reset/complete`, {
          json: body,
        })
        .json<EmailPasswordResetCompleteOutput>();

      return response;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
