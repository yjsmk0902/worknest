import { AuthMutationHandlerBase } from '@worknest/client/handlers/mutations/auth/base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import { EmailVerifyMutationInput } from '@worknest/client/mutations/auth/email-verify';
import { AppService } from '@worknest/client/services/app-service';
import { EmailVerifyInput, LoginOutput } from '@worknest/core';

export class EmailVerifyMutationHandler
  extends AuthMutationHandlerBase
  implements MutationHandler<EmailVerifyMutationInput>
{
  constructor(appService: AppService) {
    super(appService);
  }

  async handleMutation(input: EmailVerifyMutationInput): Promise<LoginOutput> {
    const server = this.app.getServer(input.server);

    if (!server) {
      throw new MutationError(
        MutationErrorCode.ServerNotFound,
        `Server ${input.server} was not found! Try using a different server.`
      );
    }

    try {
      const body: EmailVerifyInput = {
        id: input.id,
        otp: input.otp,
      };

      const response = await this.app.client
        .post(`${server.httpBaseUrl}/v1/auth/email/verify`, {
          json: body,
        })
        .json<LoginOutput>();

      if (response.type === 'verify') {
        throw new MutationError(
          MutationErrorCode.EmailVerificationFailed,
          'Email verification failed! Please try again.'
        );
      }

      await this.handleLoginSuccess(response, server);

      return response;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
