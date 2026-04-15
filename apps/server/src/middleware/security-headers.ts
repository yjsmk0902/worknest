import type { FastifyInstance } from 'fastify';

/**
 * Security headers middleware.
 *
 * Registers a Fastify `onSend` hook that sets standard security headers
 * on every response. HSTS is only added in production.
 */
export function registerSecurityHeaders(app: FastifyInstance): void {
  const isProduction = process.env.NODE_ENV === 'production';

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '0');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Content-Security-Policy', "frame-ancestors 'none'");

    if (isProduction) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });
}
