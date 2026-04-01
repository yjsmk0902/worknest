import { AuthMutationHandlerBase } from '@worknest/client/handlers/mutations/auth/base';
import { parseApiError } from '@worknest/client/lib/ky';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  GoogleLoginMutationInput,
  MutationError,
  MutationErrorCode,
} from '@worknest/client/mutations';
import { AppService } from '@worknest/client/services/app-service';
import { GoogleLoginInput, LoginOutput } from '@worknest/core';

export class GoogleLoginMutationHandler
  extends AuthMutationHandlerBase
  implements MutationHandler<GoogleLoginMutationInput>
{
  constructor(appService: AppService) {
    super(appService);
  }

  async handleMutation(input: GoogleLoginMutationInput): Promise<LoginOutput> {
    const server = this.app.getServer(input.server);

    if (!server) {
      throw new MutationError(
        MutationErrorCode.ServerNotFound,
        `Server ${input.server} was not found! Try using a different server.`
      );
    }

    try {
      const body: GoogleLoginInput = {
        code: input.code,
      };

      const response = await this.app.client
        .post(`${server.httpBaseUrl}/v1/auth/google/login`, {
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
