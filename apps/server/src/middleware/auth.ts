import { orgMembers, workspaceMembers } from '@worknest/db';
import type { Database } from '@worknest/db';
import type { OrgRole } from '@worknest/shared';
import type { WsRole } from '@worknest/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from '../lib/auth';
import { AppError, ErrorCode } from '../lib/errors';

// ── Augment Fastify Request ────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

// ── Role hierarchy helpers ─────────────────────────────────────────────

const ORG_ROLE_LEVEL: Record<string, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

const WS_ROLE_LEVEL: Record<string, number> = {
  admin: 3,
  member: 2,
  guest: 1,
};

// ── requireAuth ────────────────────────────────────────────────────────

/**
 * Create the requireAuth preHandler that validates the Better Auth session
 * from the cookie and attaches `request.user`.
 */
export function createRequireAuth(auth: Auth) {
  return async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const session = await auth.api.getSession({
      headers: request.headers as unknown as Headers,
    });

    if (!session?.user) {
      throw AppError.unauthorized();
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    };
  };
}

// ── requireOrgRole ─────────────────────────────────────────────────────

/**
 * Create a preHandler that checks the user has at least the given role
 * in the organization identified by `request.params.id` or `request.params.orgId`.
 *
 * Must be used AFTER requireAuth.
 */
export function createRequireOrgRole(db: Database, minRole: OrgRole) {
  return async function requireOrgRole(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const user = request.user;
    if (!user) throw AppError.unauthorized();

    const params = request.params as Record<string, string>;
    const orgId = params.id ?? params.orgId;
    if (!orgId)
      throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Organization ID is required');

    const member = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.forbidden('You are not a member of this organization');
    }

    const userLevel = ORG_ROLE_LEVEL[member.role] ?? 0;
    const requiredLevel = ORG_ROLE_LEVEL[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      throw AppError.forbidden(`Requires at least ${minRole} role in this organization`);
    }
  };
}

// ── requireWsRole ──────────────────────────────────────────────────────

/**
 * Create a preHandler that checks the user has at least the given role
 * in the workspace identified by `request.params.id` or `request.params.wsId`.
 *
 * Must be used AFTER requireAuth.
 */
export function createRequireWsRole(db: Database, minRole: WsRole) {
  return async function requireWsRole(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const user = request.user;
    if (!user) throw AppError.unauthorized();

    const params = request.params as Record<string, string>;
    const wsId = params.id ?? params.wsId;
    if (!wsId) throw AppError.badRequest(ErrorCode.VALIDATION_ERROR, 'Workspace ID is required');

    const member = await db
      .select()
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, user.id)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.forbidden('You are not a member of this workspace');
    }

    const userLevel = WS_ROLE_LEVEL[member.role] ?? 0;
    const requiredLevel = WS_ROLE_LEVEL[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      throw AppError.forbidden(`Requires at least ${minRole} role in this workspace`);
    }
  };
}
