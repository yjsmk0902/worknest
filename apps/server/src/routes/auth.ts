import type { FastifyInstance } from "fastify";
import type { Auth } from "../lib/auth";
import type { Database } from "@worknest/db";
import { authRateLimit } from "../middleware/rate-limit";
import { createRequireAuth } from "../middleware/auth";
import {
  registerInput,
  loginInput,
  acceptInvitationParams,
} from "@worknest/shared";
import { eq } from "drizzle-orm";
import { invitations as invitationsTable } from "@worknest/db";
import { OrganizationService } from "../services/organization-service";
import { WorkspaceService } from "../services/workspace-service";
import { AppError, ErrorCode } from "../lib/errors";
import { createHash } from "node:crypto";

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
    "/api/v1/auth/register",
    {
      preHandler: [authRateLimit],
      schema: {
        tags: ["Auth"],
        summary: "Register a new account",
        body: registerInput,
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
        headers: request.headers as unknown as Headers,
      });

      if (!response?.user) {
        throw AppError.badRequest(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          "An account with this email already exists",
        );
      }

      // Copy set-cookie headers from Better Auth response
      const setCookieHeader = (response as unknown as { headers?: Headers })?.headers?.get?.("set-cookie");
      if (setCookieHeader) {
        reply.header("set-cookie", setCookieHeader);
      }

      return reply.status(201).send({
        data: {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
        },
      });
    },
  );

  // ── POST /api/v1/auth/login ────────────────────────────────────────

  app.post(
    "/api/v1/auth/login",
    {
      preHandler: [authRateLimit],
      schema: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        body: loginInput,
      },
    },
    async (request, reply) => {
      const body = loginInput.parse(request.body);

      const response = await auth.api.signInEmail({
        body: {
          email: body.email,
          password: body.password,
        },
        headers: request.headers as unknown as Headers,
      });

      if (!response?.user) {
        throw AppError.unauthorized("Invalid email or password");
      }

      const setCookieHeader = (response as unknown as { headers?: Headers })?.headers?.get?.("set-cookie");
      if (setCookieHeader) {
        reply.header("set-cookie", setCookieHeader);
      }

      return reply.status(200).send({
        data: {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
        },
      });
    },
  );

  // ── POST /api/v1/auth/logout ───────────────────────────────────────

  app.post(
    "/api/v1/auth/logout",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Auth"],
        summary: "Log out (invalidate session)",
      },
    },
    async (request, reply) => {
      await auth.api.signOut({
        headers: request.headers as unknown as Headers,
      });

      return reply.status(200).send({ data: { success: true } });
    },
  );

  // ── GET /api/v1/auth/invitations/:token ─────────────────────────

  app.get(
    "/api/v1/auth/invitations/:token",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get invitation info by token (no auth required)",
        params: acceptInvitationParams,
      },
    },
    async (_request, reply) => {
      const { token } = acceptInvitationParams.parse(_request.params);
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const invitation = await db
        .select()
        .from(invitationsTable)
        .where(eq(invitationsTable.tokenHash, tokenHash))
        .limit(1)
        .then((rows) => rows[0]);

      if (!invitation) {
        throw AppError.notFound("invitation");
      }

      return reply.status(200).send({
        data: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expired: new Date(invitation.expiresAt) < new Date(),
          accepted: !!invitation.acceptedAt,
          orgId: invitation.orgId,
          workspaceId: invitation.workspaceId,
        },
      });
    },
  );

  // ── POST /api/v1/auth/invitations/:token/accept ───────────────────

  app.post(
    "/api/v1/auth/invitations/:token/accept",
    {
      preHandler: [requireAuth],
      schema: {
        tags: ["Auth"],
        summary: "Accept an invitation by token",
        params: acceptInvitationParams,
      },
    },
    async (request, reply) => {
      const { token } = acceptInvitationParams.parse(request.params);
      const userId = request.user!.id;

      // Try org invitation first, then workspace
      const result = await orgService.acceptInvitation(userId, token)
        ?? await wsService.acceptInvitation(userId, token);

      if (!result) {
        throw AppError.notFound("invitation");
      }

      return reply.status(200).send({ data: result });
    },
  );
}
