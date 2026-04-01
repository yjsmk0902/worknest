import { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod/v4';

import { database } from '@worknest/server/data/database';
import { eventBus } from '@worknest/server/lib/event-bus';

export const logoutRoute: FastifyPluginCallbackZod = (instance, _, done) => {
  instance.route({
    method: 'DELETE',
    url: '/logout',
    schema: {
      tags: ["Auth"],
      response: {
        200: z.object({}),
      },
    },
    handler: async (request) => {
      const account = request.account;

      await database
        .deleteFrom('devices')
        .where('id', '=', account.deviceId)
        .execute();

      eventBus.publish({
        type: 'device.deleted',
        accountId: account.id,
        deviceId: account.deviceId,
      });

      return {};
    },
  });

  done();
};
