import { FastifyPluginCallback } from 'fastify';

import { build } from '@worknest/core';
import { config } from '@worknest/server/lib/config';
import { generateUrl } from '@worknest/server/lib/fastify';
import { homeTemplate } from '@worknest/server/templates';

export const homeRoute: FastifyPluginCallback = (instance, _, done) => {
  instance.route({
    method: 'GET',
    url: '/',
    handler: async (request, reply) => {
      const configUrl = generateUrl(request, '/config');

      const template = homeTemplate({
        name: config.name,
        url: configUrl,
        version: build.version,
        sha: build.sha,
      });

      reply.type('text/html').send(template);
    },
  });

  done();
};
