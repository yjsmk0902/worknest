import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import ms from 'ms';

import {
  generateId,
  IdType,
  ApiErrorCode,
  EmailPasswordResetInitOutput,
  apiErrorOutputSchema,
  emailPasswordResetInitOutputSchema,
  emailPasswordResetInitInputSchema,
} from '@worknest/core';
import { database } from '@worknest/server/data/database';
import { config } from '@worknest/server/lib/config';
import { generateOtpCode, saveOtp } from '@worknest/server/lib/otps';
import { isAuthEmailRateLimited } from '@worknest/server/lib/rate-limits';
import { jobService } from '@worknest/server/services/job-service';
import {
  AccountPasswordResetOtpAttributes,
  Otp,
} from '@worknest/server/types/otps';

export const emailPasswordResetInitRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'POST',
    url: '/email/password-reset/init',
    schema: {
      body: emailPasswordResetInitInputSchema,
      response: {
        200: emailPasswordResetInitOutputSchema,
        400: apiErrorOutputSchema,
        429: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      const input = request.body;
      const email = input.email.toLowerCase();

      const isEmailRateLimited = await isAuthEmailRateLimited(email);
      if (isEmailRateLimited) {
        return reply.code(429).send({
          code: ApiErrorCode.TooManyRequests,
          message: 'Too many authentication attempts. Please try again later.',
        });
      }

      const id = generateId(IdType.OtpCode);
      const expiresAt = new Date(
        Date.now() + ms(`${config.account.otpTimeout} seconds`)
      ).toISOString();
      const otpCode = generateOtpCode();

      const account = await database
        .selectFrom('accounts')
        .selectAll()
        .where('email', '=', email)
        .executeTakeFirst();

      if (!account) {
        const output: EmailPasswordResetInitOutput = {
          id,
          expiresAt,
        };
        return output;
      }

      const otp: Otp<AccountPasswordResetOtpAttributes> = {
        id,
        expiresAt,
        otp: otpCode,
        attributes: {
          accountId: account.id,
          attempts: 0,
        },
      };

      await saveOtp(id, otp);
      await jobService.addJob({
        type: 'email.password.reset.send',
        otpId: id,
      });

      const output: EmailPasswordResetInitOutput = {
        id,
        expiresAt,
      };

      return output;
    },
  });

  done();
};
