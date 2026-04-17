import { type Database, joinRequests, orgMembers, organizations, users } from '@worknest/db';
import type { CursorPaginationQuery } from '@worknest/shared';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';
import type { NotificationService } from './notification-service';

// ── Service ────────────────────────────────────────────────────────────

export class JoinRequestService {
  constructor(
    private db: Database,
    private notificationService: NotificationService,
  ) {}

  // ── Create Request ─────────────────────────────────────────────────

  /**
   * Create a join request for the given organization.
   * Verifies the user is not already a member and has no pending request.
   */
  async createRequest(orgId: string, userId: string, message?: string) {
    // Verify org exists
    const org = await this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(and(eq(organizations.id, orgId), isNull(organizations.deletedAt)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!org) {
      throw AppError.notFound('organization');
    }

    // Verify user is NOT already a member
    const existingMember = await this.db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (existingMember) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        'You are already a member of this organization',
      );
    }

    // Verify no pending request exists (the unique index also enforces this)
    const existingRequest = await this.db
      .select({ id: joinRequests.id })
      .from(joinRequests)
      .where(
        and(
          eq(joinRequests.orgId, orgId),
          eq(joinRequests.userId, userId),
          eq(joinRequests.status, 'pending'),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existingRequest) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        'You already have a pending join request for this organization',
      );
    }

    const [request] = await this.db
      .insert(joinRequests)
      .values({
        orgId,
        userId,
        message: message ?? null,
        status: 'pending',
      })
      .returning();

    // Dispatch notification to all admin/owner members (fire-and-forget)
    const adminMembers = await this.db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'owner')));

    const adminMembersAdditional = await this.db
      .select({ userId: orgMembers.userId })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, 'admin')));

    const recipientIds = [
      ...adminMembers.map((m) => m.userId),
      ...adminMembersAdditional.map((m) => m.userId),
    ];

    if (recipientIds.length > 0) {
      this.notificationService
        .dispatchNotification({
          type: 'join_request_received',
          actorId: userId,
          recipientIds,
          message: `A user has requested to join ${org.name}`,
        })
        .catch(() => {});
    }

    return {
      id: request!.id,
      orgId: request!.orgId,
      userId: request!.userId,
      message: request!.message,
      status: request!.status,
      reviewedBy: request!.reviewedBy,
      reviewedAt: request!.reviewedAt?.toISOString() ?? null,
      createdAt: request!.createdAt.toISOString(),
    };
  }

  // ── List Pending by Org ────────────────────────────────────────────

  /**
   * List pending join requests for an organization.
   * Caller must be admin/owner (verified by route middleware).
   */
  async listPendingByOrg(orgId: string, pagination: CursorPaginationQuery) {
    const { cursor, limit } = pagination;

    const rows = await this.db
      .select({
        request: joinRequests,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(joinRequests)
      .innerJoin(users, eq(joinRequests.userId, users.id))
      .where(
        and(
          eq(joinRequests.orgId, orgId),
          eq(joinRequests.status, 'pending'),
          ...(cursor ? [lt(joinRequests.createdAt, new Date(cursor))] : []),
        ),
      )
      .orderBy(desc(joinRequests.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: items.map((row) => ({
        id: row.request.id,
        orgId: row.request.orgId,
        userId: row.request.userId,
        message: row.request.message,
        status: row.request.status,
        reviewedBy: row.request.reviewedBy,
        reviewedAt: row.request.reviewedAt?.toISOString() ?? null,
        createdAt: row.request.createdAt.toISOString(),
        user: {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          avatarUrl: row.user.avatarUrl,
        },
      })),
      pagination: {
        next_cursor: hasMore ? items[items.length - 1]?.request.createdAt.toISOString() : null,
        has_more: hasMore,
      },
    };
  }

  // ── Review Request ─────────────────────────────────────────────────

  /**
   * Approve or reject a join request. Reviewer must be admin/owner of the org.
   */
  async reviewRequest(requestId: string, reviewerId: string, action: 'approve' | 'reject') {
    const request = await this.db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, requestId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!request) {
      throw AppError.notFound('join request');
    }

    if (request.status !== 'pending') {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        `This join request has already been ${request.status}`,
      );
    }

    // Verify reviewer is admin/owner of the org
    const reviewerMember = await this.db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, request.orgId), eq(orgMembers.userId, reviewerId)))
      .limit(1)
      .then((rows) => rows[0]);

    if (!reviewerMember || !['owner', 'admin'].includes(reviewerMember.role)) {
      throw AppError.forbidden('Only org owner or admin can review join requests');
    }

    const now = new Date();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    if (action === 'approve') {
      // Approve: add member + update status atomically
      await this.db.transaction(async (tx) => {
        await tx
          .insert(orgMembers)
          .values({
            orgId: request.orgId,
            userId: request.userId,
            role: 'member',
          })
          .onConflictDoNothing();

        await tx
          .update(joinRequests)
          .set({
            status: newStatus,
            reviewedBy: reviewerId,
            reviewedAt: now,
          })
          .where(eq(joinRequests.id, requestId));
      });
    } else {
      // Reject: just update status
      await this.db
        .update(joinRequests)
        .set({
          status: newStatus,
          reviewedBy: reviewerId,
          reviewedAt: now,
        })
        .where(eq(joinRequests.id, requestId));
    }

    // Fetch org name for notification message
    const org = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, request.orgId))
      .limit(1)
      .then((rows) => rows[0]);

    const notificationType =
      action === 'approve' ? 'join_request_approved' : 'join_request_rejected';

    this.notificationService
      .dispatchNotification({
        type: notificationType,
        actorId: reviewerId,
        recipientIds: [request.userId],
        message:
          action === 'approve'
            ? `Your request to join ${org?.name ?? 'the organization'} has been approved`
            : `Your request to join ${org?.name ?? 'the organization'} has been rejected`,
      })
      .catch(() => {});

    return {
      id: requestId,
      orgId: request.orgId,
      userId: request.userId,
      message: request.message,
      status: newStatus,
      reviewedBy: reviewerId,
      reviewedAt: now.toISOString(),
      createdAt: request.createdAt.toISOString(),
    };
  }

  // ── Cancel Request ─────────────────────────────────────────────────

  /**
   * Cancel a pending join request. Only the requester can cancel.
   */
  async cancelRequest(requestId: string, userId: string) {
    const request = await this.db
      .select()
      .from(joinRequests)
      .where(eq(joinRequests.id, requestId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!request) {
      throw AppError.notFound('join request');
    }

    if (request.userId !== userId) {
      throw AppError.forbidden('You can only cancel your own join requests');
    }

    if (request.status !== 'pending') {
      throw AppError.badRequest(
        ErrorCode.VALIDATION_ERROR,
        `Cannot cancel a join request that has already been ${request.status}`,
      );
    }

    await this.db.delete(joinRequests).where(eq(joinRequests.id, requestId));
  }
}
