import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
} from 'fastify-type-provider-zod';

const swaggerCallback: FastifyPluginCallback = (fastify, _, done) => {
  fastify.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Worknest API',
        description: 'Worknest Server REST API documentation',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Account authentication token',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication and registration' },
        { name: 'Accounts', description: 'Account management and sync' },
        { name: 'Workspaces', description: 'Workspace CRUD operations' },
        { name: 'Users', description: 'Workspace user management' },
        { name: 'Files', description: 'File upload and download' },
        { name: 'Avatars', description: 'Avatar upload and download' },
        { name: 'Mutations', description: 'Data mutation synchronization' },
        { name: 'Sockets', description: 'WebSocket connection management' },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });

  fastify.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 3,
    },
  });

  done();
};

export const swaggerPlugin = fp(swaggerCallback);
