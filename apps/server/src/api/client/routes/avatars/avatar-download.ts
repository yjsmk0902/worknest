import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { ApiErrorCode, apiErrorOutputSchema } from '@worknest/core';
import { storage } from '@worknest/server/lib/storage';

export const avatarDownloadRoute: FastifyPluginCallbackZod = (
  instance,
  _,
  done
) => {
  instance.route({
    method: 'GET',
    url: '/:avatarId',
    schema: {
      tags: ["Avatars"],
      params: z.object({
        avatarId: z.string(),
      }),
      response: {
        500: apiErrorOutputSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const avatarId = request.params.avatarId;
        const { stream } = await storage.download(`avatars/${avatarId}.jpeg`);

        reply.header('Content-Type', 'image/jpeg');
        return reply.send(stream);
      } catch {
        return reply.code(500).send({
          code: ApiErrorCode.AvatarDownloadFailed,
          message: 'Failed to download avatar',
        });
      }
    },
  });

  done();
};
