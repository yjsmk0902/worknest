import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { ApiErrorCode } from '@worknest/core';
import { createLogger } from '@worknest/server/lib/logger';

const logger = createLogger('api:client:error-handler');

export const errorHandlerCallback: FastifyPluginCallback = (
  fastify,
  _,
  done
) => {
  fastify.setErrorHandler(async (error, _, reply) => {
    logger.error(error, `Error processing request`);

    if (hasZodFastifySchemaValidationErrors(error)) {
      const fields: Record<string, string[]> = {};

      for (const validationError of error.validation) {
        const issue = validationError.params?.issue;
        if (!issue) {
          continue;
        }

        const fieldName =
          Array.isArray(issue.path) && issue.path.length > 0
            ? issue.path.join('.')
            : '_root';

        if (!fields[fieldName]) {
          fields[fieldName] = [];
        }

        fields[fieldName].push(issue.message ?? 'Invalid value');
      }

      return reply.code(400).send({
        code: ApiErrorCode.ValidationError,
        message:
          'One or more fields are invalid. Please check your request and try again.',
        fields,
      });
    }

    return reply.code(500).send({
      code: ApiErrorCode.Unknown,
      message: 'An unexpected error occurred. Please try again later.',
    });
  });

  done();
};

export const errorHandler = fp(errorHandlerCallback);
