import type { Database } from '@worknest/db';
import {
  createJoinRequestInput,
  cursorPaginationQuery,
  reviewJoinRequestInput,
  uuidParam,
} from '@worknest/shared';
import type { FastifyInstance } from 'fastify';
import type { Auth } from '../lib/auth';
import { createRequireAuth, createRequireOrgRole } from '../middleware/auth';
import { JoinRequestService } from '../services/join-request-service';
import { NotificationService } from '../services/notification-service';

/**
 * Join request routes.
 *
 * Handles the flow where users request to join an organization and
 * admins/owners approve or reject those requests.
 */
export async function joinRequestRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const requireAdmin = createRequireOrgRole(db, 'admin');
  const notificationService = new NotificationService(db);
  const service = new JoinRequestService(db, notificationService);

  // ── POST /api/v1/organizations/:id/join-requests ────────────────────
  // Any authenticated user can request to join an organization.

  app.post(
    '/api/v1/organizations/:id/join-requests',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Join Requests'],
        summary: 'Request to join an organization',
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const body = createJoinRequestInput.parse(request.body);
      const result = await service.createRequest(id, request.user?.id, body.message);
      return reply.status(201).send({ data: result });
    },
  );

  // ── GET /api/v1/organizations/:id/join-requests ─────────────────────
  // Admin+ can list pending join requests for their organization.

  app.get(
    '/api/v1/organizations/:id/join-requests',
    {
      preHandler: [requireAuth, requireAdmin],
      schema: {
        tags: ['Join Requests'],
        summary: 'List pending join requests for an organization (admin+)',
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const pagination = cursorPaginationQuery.parse(request.query);
      const result = await service.listPendingByOrg(id, pagination);
      return reply.status(200).send(result);
    },
  );

  // ── POST /api/v1/join-requests/:id/review ───────────────────────────
  // Admin+ can approve or reject a join request.

  app.post(
    '/api/v1/join-requests/:id/review',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Join Requests'],
        summary: 'Approve or reject a join request (admin+)',
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      const body = reviewJoinRequestInput.parse(request.body);
      const result = await service.reviewRequest(id, request.user?.id, body.action);
      return reply.status(200).send({ data: result });
    },
  );

  // ── DELETE /api/v1/join-requests/:id ────────────────────────────────
  // The requester can cancel their own pending join request.

  app.delete(
    '/api/v1/join-requests/:id',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Join Requests'],
        summary: 'Cancel own pending join request',
      },
    },
    async (request, reply) => {
      const { id } = uuidParam.parse(request.params);
      await service.cancelRequest(id, request.user?.id);
      return reply.status(204).send();
    },
  );
}
