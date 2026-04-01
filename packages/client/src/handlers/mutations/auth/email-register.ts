import { AuthMutationHandlerBase } from '@worknest/client/handlers/mutations/auth/base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import { MutationError, MutationErrorCode } from '@worknest/client/mutations';
import { EmailRegisterMutationInput } from '@worknest/client/mutations/auth/email-register';
import { AppService } from '@worknest/client/services/app-service';
import { EmailRegisterInput, LoginOutput } from '@worknest/core';

export class EmailRegisterMutationHandler
  extends AuthMutationHandlerBase
  implements MutationHandler<EmailRegisterMutationInput>
{
  constructor(appService: AppService) {
    super(appService);
  }

  async handleMutation(
    input: EmailRegisterMutationInput
  ): Promise<LoginOutput> {
    const server = this.app.getServer(input.server);

    if (!server) {
      throw new MutationError(
        MutationErrorCode.ServerNotFound,
        `Server ${input.server} was not found! Try using a different server.`
      );
    }

    try {
      const body: EmailRegisterInput = {
        name: input.name,
        email: input.email,
        password: input.password,
      };

      const response = await this.app.client
        .post(`${server.httpBaseUrl}/v1/auth/email/register`, {
          json: body,
        })
        .json<LoginOutput>();

      if (response.type === 'verify') {
        return response;
      }

      await this.handleLoginSuccess(response, server);

      return response;
    } catch (error) {
      const apiError = await parseApiError(error);
      throw new MutationError(MutationErrorCode.ApiError, apiError.message);
    }
  }
}
