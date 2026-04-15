import { createHash } from 'node:crypto';
import type { Database } from '@worknest/db';
import {
  invitations as invitationsTable,
  organizations,
  users as usersTable,
  workspaces,
} from '@worknest/db';
import { acceptInvitationParams, loginInput, registerInput } from '@worknest/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Auth } from '../lib/auth';
import { AppError, ErrorCode } from '../lib/errors';
import { createRequireAuth } from '../middleware/auth';
import { authRateLimit } from '../middleware/rate-limit';
import { OrganizationService } from '../services/organization-service';
import { WorkspaceService } from '../services/workspace-service';

/**
 * Authentication routes.
 *
 * These delegate to Better Auth handlers for the heavy lifting,
 * wrapping them in our standard API response format.
 */
export async function authRoutes(
  app: FastifyInstance,
  opts: { auth: Auth; db: Database },
): Promise<void> {
  const { auth, db } = opts;
  const requireAuth = createRequireAuth(auth);
  const orgService = new OrganizationService(db);
  const wsService = new WorkspaceService(db);

  // ── POST /api/v1/auth/register ─────────────────────────────────────

  app.post(
    '/api/v1/auth/register',
    {
      preHandler: [authRateLimit],
      schema: {
        tags: ['Auth'],
        summary: 'Register a new account',
      },
    },
    async (request, reply) => {
      const body = registerInput.parse(request.body);

      const response = await auth.api.signUpEmail({
        body: {
          email: body.email,
          password: body.password,
          name: body.name,
        },
        asResponse: true,
        headers: request.headers as unknown as Headers,
      });

      if (!response.ok) {
        throw AppError.badRequest(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          'An account with this email already exists',
        );
      }

      // Copy set-cookie headers from Better Auth response
      const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
      for (const cookie of setCookieHeaders) {
        reply.header('set-cookie', cookie);
      }

      const responseBody = await response.json();

      return reply.status(201).send({
        data: {
          id: responseBody.user?.id ?? responseBody.id,
          email: responseBody.user?.email ?? responseBody.email,
          name: responseBody.user?.name ?? responseBody.name,
        },
      });
    },
  );

  // ── POST /api/v1/auth/login ────────────────────────────────────────

  app.post(
    '/api/v1/auth/login',
    {
      preHandler: [authRateLimit],
      schema: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
      },
    },
    async (request, reply) => {
      const body = loginInput.parse(request.body);

      const response = await auth.api.signInEmail({
        body: {
          email: body.email,
          password: body.password,
        },
        asResponse: true,
        headers: request.headers as unknown as Headers,
      });

      if (!response.ok) {
        throw AppError.unauthorized('Invalid email or password');
      }

      const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
      for (const cookie of setCookieHeaders) {
        reply.header('set-cookie', cookie);
      }

      const responseBody = await response.json();

      return reply.status(200).send({
        data: {
          id: responseBody.user?.id ?? responseBody.id,
          email: responseBody.user?.email ?? responseBody.email,
          name: responseBody.user?.name ?? responseBody.name,
        },
      });
    },
  );

  // ── POST /api/v1/auth/logout ───────────────────────────────────────

  app.post(
    '/api/v1/auth/logout',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Log out (invalidate session)',
      },
    },
    async (request, reply) => {
      try {
        const response = await auth.api.signOut({
          headers: request.headers as unknown as Headers,
          asResponse: true,
        });

        const setCookieHeaders = response.headers.getSetCookie?.() ?? [];
        for (const cookie of setCookieHeaders) {
          reply.header('set-cookie', cookie);
        }
      } catch {
        // If signOut fails, manually clear session cookies
        const cookiePrefix = 'worknest';
        reply.header('set-cookie', `${cookiePrefix}.session_token=; Path=/; HttpOnly; Max-Age=0`);
      }

      return reply.status(200).send({ data: { success: true } });
    },
  );

  // ── GET /api/v1/auth/invitations/:token ─────────────────────────

  app.get(
    '/api/v1/auth/invitations/:token',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get invitation info by token (no auth required)',
      },
    },
    async (_request, reply) => {
      const { token } = acceptInvitationParams.parse(_request.params);
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const invitation = await db
        .select()
        .from(invitationsTable)
        .where(eq(invitationsTable.tokenHash, tokenHash))
        .limit(1)
        .then((rows) => rows[0]);

      if (!invitation) {
        throw AppError.notFound('invitation');
      }

      // Resolve org/workspace name
      let orgName: string | undefined;
      let workspaceName: string | undefined;

      if (invitation.orgId) {
        const org = await db
          .select({ name: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, invitation.orgId))
          .limit(1)
          .then((rows) => rows[0]);
        orgName = org?.name;
      }

      if (invitation.workspaceId) {
        const ws = await db
          .select({ name: workspaces.name })
          .from(workspaces)
          .where(eq(workspaces.id, invitation.workspaceId))
          .limit(1)
          .then((rows) => rows[0]);
        workspaceName = ws?.name;
      }

      // Check if account exists for this email
      const existingUser = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, invitation.email))
        .limit(1)
        .then((rows) => rows[0]);

      return reply.status(200).send({
        data: {
          email: invitation.email,
          role: invitation.role,
          orgName,
          workspaceName,
          hasAccount: !!existingUser,
          expired: new Date(invitation.expiresAt) < new Date(),
          accepted: !!invitation.acceptedAt,
        },
      });
    },
  );

  // ── POST /api/v1/auth/invitations/:token/accept ───────────────────

  app.post(
    '/api/v1/auth/invitations/:token/accept',
    {
      preHandler: [requireAuth],
      schema: {
        tags: ['Auth'],
        summary: 'Accept an invitation by token',
      },
    },
    async (request, reply) => {
      const { token } = acceptInvitationParams.parse(request.params);
      const userId = request.user?.id;

      // Try org invitation first, then workspace
      const result =
        (await orgService.acceptInvitation(userId, token)) ??
        (await wsService.acceptInvitation(userId, token));

      if (!result) {
        throw AppError.notFound('invitation');
      }

      return reply.status(200).send({ data: result });
    },
  );
}
