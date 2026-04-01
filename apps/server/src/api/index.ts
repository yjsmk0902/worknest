import { FastifyPluginCallback } from 'fastify';

import { clientRoutes } from '@worknest/server/api/client/routes';
import { configGetRoute } from '@worknest/server/api/config';
import { homeRoute } from '@worknest/server/api/home';
import { config } from '@worknest/server/lib/config';

export const apiRoutes: FastifyPluginCallback = (instance, _, done) => {
  const prefix = config.pathPrefix ? `/${config.pathPrefix}` : '';

  instance.register(homeRoute, { prefix });
  instance.register(configGetRoute, { prefix });
  instance.register(clientRoutes, { prefix: `${prefix}/client/v1` });

  done();
};
