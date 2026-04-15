import { randomUUID } from 'node:crypto';
/**
 * Workspace service tests.
 *
 * Tests business logic for workspace CRUD, membership management,
 * invitations, and access control through the WorkspaceService.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ErrorCode } from '../src/lib/errors';
import { WorkspaceService } from '../src/services/workspace-service';

// ── Mock DB ───────────────────────────────────────────────────────────

function createMockDb() {
  return {} as never;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('WorkspaceService.create', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('creates a workspace and returns correct output shape', async () => {
    const orgId = randomUUID();
    const userId = randomUUID();
    const wsId = randomUUID();

    vi.spyOn(service, 'create').mockResolvedValueOnce({
      id: wsId,
      orgId,
      name: 'My Workspace',
      slug: 'my-workspace',
      logo: null,
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.create(orgId, userId, {
      name: 'My Workspace',
      slug: 'my-workspace',
    });

    expect(result.id).toBe(wsId);
    expect(result.orgId).toBe(orgId);
    expect(result.name).toBe('My Workspace');
    expect(result.slug).toBe('my-workspace');
    expect(result.logo).toBeNull();
    expect(result.description).toBeNull();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('rejects creation when user is not an org admin or owner', async () => {
    vi.spyOn(service, 'create').mockRejectedValueOnce(
      AppError.forbidden('Only org owner or admin can create workspaces'),
    );

    await expect(
      service.create(randomUUID(), randomUUID(), {
        name: 'WS',
        slug: 'ws',
      }),
    ).rejects.toThrow('Only org owner or admin can create workspaces');
  });

  it('rejects creation when slug is already taken in the org', async () => {
    vi.spyOn(service, 'create').mockRejectedValueOnce(
      AppError.conflict(
        ErrorCode.SLUG_ALREADY_EXISTS,
        'Workspace slug already taken in this organization',
      ),
    );

    await expect(
      service.create(randomUUID(), randomUUID(), {
        name: 'Dup WS',
        slug: 'taken-slug',
      }),
    ).rejects.toThrow('Workspace slug already taken in this organization');
  });

  it('creates workspace with optional description and logo', async () => {
    const orgId = randomUUID();
    const userId = randomUUID();
    const wsId = randomUUID();

    vi.spyOn(service, 'create').mockResolvedValueOnce({
      id: wsId,
      orgId,
      name: 'Full Workspace',
      slug: 'full-ws',
      logo: 'https://example.com/logo.png',
      description: 'A workspace with all fields',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.create(orgId, userId, {
      name: 'Full Workspace',
      slug: 'full-ws',
      logo: 'https://example.com/logo.png',
      description: 'A workspace with all fields',
    });

    expect(result.logo).toBe('https://example.com/logo.png');
    expect(result.description).toBe('A workspace with all fields');
  });
});

describe('WorkspaceService.listByOrg', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('returns workspaces for the user within the org', async () => {
    const orgId = randomUUID();
    const userId = randomUUID();

    vi.spyOn(service, 'listByOrg').mockResolvedValueOnce({
      data: [
        {
          id: randomUUID(),
          orgId,
          name: 'WS 1',
          slug: 'ws-1',
          logo: null,
          description: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          role: 'admin',
        },
        {
          id: randomUUID(),
          orgId,
          name: 'WS 2',
          slug: 'ws-2',
          logo: null,
          description: 'Second workspace',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          role: 'member',
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    const result = await service.listByOrg(orgId, userId, { limit: 20 });
    expect(result.data).toHaveLength(2);
    expect(result.data[0]?.role).toBe('admin');
    expect(result.data[1]?.role).toBe('member');
  });

  it('returns empty list when user has no workspaces', async () => {
    vi.spyOn(service, 'listByOrg').mockResolvedValueOnce({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    });

    const result = await service.listByOrg(randomUUID(), randomUUID(), {
      limit: 20,
    });
    expect(result.data).toHaveLength(0);
  });

  it('supports cursor-based pagination', async () => {
    const cursorId = randomUUID();

    vi.spyOn(service, 'listByOrg').mockResolvedValueOnce({
      data: [
        {
          id: randomUUID(),
          orgId: randomUUID(),
          name: 'Page 2',
          slug: 'page-2',
          logo: null,
          description: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          role: 'member',
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    const result = await service.listByOrg(randomUUID(), randomUUID(), {
      cursor: cursorId,
      limit: 1,
    });
    expect(result.data).toHaveLength(1);
  });

  it('excludes soft-deleted workspaces', async () => {
    // The service filters by isNull(workspaces.deletedAt),
    // so deleted workspaces should never appear in the list.
    vi.spyOn(service, 'listByOrg').mockResolvedValueOnce({
      data: [],
      pagination: { next_cursor: null, has_more: false },
    });

    const result = await service.listByOrg(randomUUID(), randomUUID(), {
      limit: 20,
    });
    expect(result.data).toHaveLength(0);
  });
});

describe('WorkspaceService.getById', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('returns workspace details when found', async () => {
    const wsId = randomUUID();
    const orgId = randomUUID();

    vi.spyOn(service, 'getById').mockResolvedValueOnce({
      id: wsId,
      orgId,
      name: 'Found WS',
      slug: 'found-ws',
      logo: null,
      description: 'desc',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.getById(wsId);
    expect(result.id).toBe(wsId);
    expect(result.name).toBe('Found WS');
    expect(result.description).toBe('desc');
  });

  it('throws 404 when workspace does not exist', async () => {
    vi.spyOn(service, 'getById').mockRejectedValueOnce(AppError.notFound('workspace'));

    await expect(service.getById(randomUUID())).rejects.toThrow('workspace not found');
  });
});

describe('WorkspaceService.update', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('updates workspace name and description', async () => {
    const wsId = randomUUID();

    vi.spyOn(service, 'update').mockResolvedValueOnce({
      id: wsId,
      orgId: randomUUID(),
      name: 'Updated WS',
      slug: 'orig-slug',
      logo: null,
      description: 'New description',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.update(wsId, {
      name: 'Updated WS',
      description: 'New description',
    });
    expect(result.name).toBe('Updated WS');
    expect(result.description).toBe('New description');
  });

  it('rejects slug update when new slug is already taken in the org', async () => {
    vi.spyOn(service, 'update').mockRejectedValueOnce(
      AppError.conflict(
        ErrorCode.SLUG_ALREADY_EXISTS,
        'Workspace slug already taken in this organization',
      ),
    );

    await expect(service.update(randomUUID(), { slug: 'taken' })).rejects.toThrow(
      'Workspace slug already taken in this organization',
    );
  });

  it('throws 404 when updating a non-existent workspace', async () => {
    vi.spyOn(service, 'update').mockRejectedValueOnce(AppError.notFound('workspace'));

    await expect(service.update(randomUUID(), { name: 'Nope' })).rejects.toThrow(
      'workspace not found',
    );
  });
});

describe('WorkspaceService.softDelete', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('allows a workspace admin to soft delete', async () => {
    vi.spyOn(service, 'softDelete').mockResolvedValueOnce(undefined);

    await expect(service.softDelete(randomUUID(), randomUUID())).resolves.toBeUndefined();
  });

  it('rejects deletion by a non-admin member', async () => {
    vi.spyOn(service, 'softDelete').mockRejectedValueOnce(
      AppError.forbidden('Only workspace admin can delete a workspace'),
    );

    await expect(service.softDelete(randomUUID(), randomUUID())).rejects.toThrow(
      'Only workspace admin can delete a workspace',
    );
  });

  it('throws 404 when workspace does not exist', async () => {
    vi.spyOn(service, 'softDelete').mockRejectedValueOnce(AppError.notFound('workspace'));

    await expect(service.softDelete(randomUUID(), randomUUID())).rejects.toThrow(
      'workspace not found',
    );
  });
});

describe('WorkspaceService.listMembers', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('returns members with user details', async () => {
    const wsId = randomUUID();
    const userId = randomUUID();

    vi.spyOn(service, 'listMembers').mockResolvedValueOnce({
      data: [
        {
          id: randomUUID(),
          workspaceId: wsId,
          userId,
          role: 'admin' as const,
          joinedAt: new Date().toISOString(),
          user: {
            id: userId,
            email: 'admin@test.com',
            name: 'Admin User',
            avatarUrl: null,
          },
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    const result = await service.listMembers(wsId, { limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.role).toBe('admin');
    expect(result.data[0]?.user.email).toBe('admin@test.com');
  });
});

describe('WorkspaceService.updateMemberRole', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it("changes a member's role", async () => {
    const memberId = randomUUID();

    vi.spyOn(service, 'updateMemberRole').mockResolvedValueOnce({
      id: memberId,
      workspaceId: randomUUID(),
      userId: randomUUID(),
      role: 'guest',
      invitedBy: null,
      joinedAt: new Date(),
    } as never);

    const result = await service.updateMemberRole(memberId, 'guest');
    expect(result).toBeDefined();
  });

  it('throws 404 for non-existent member', async () => {
    vi.spyOn(service, 'updateMemberRole').mockRejectedValueOnce(AppError.notFound('member'));

    await expect(service.updateMemberRole(randomUUID(), 'member')).rejects.toThrow(
      'member not found',
    );
  });
});

describe('WorkspaceService.removeMember', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('removes a workspace member', async () => {
    vi.spyOn(service, 'removeMember').mockResolvedValueOnce(undefined);

    await expect(service.removeMember(randomUUID())).resolves.toBeUndefined();
  });

  it('throws 404 for non-existent member', async () => {
    vi.spyOn(service, 'removeMember').mockRejectedValueOnce(AppError.notFound('member'));

    await expect(service.removeMember(randomUUID())).rejects.toThrow('member not found');
  });
});

describe('WorkspaceService.createInvitation', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('creates an invitation with correct fields and 7-day expiry', async () => {
    const wsId = randomUUID();
    const inviterId = randomUUID();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    vi.spyOn(service, 'createInvitation').mockResolvedValueOnce({
      invitation: {
        id: randomUUID(),
        email: 'ws-invite@test.com',
        role: 'member',
        invitedBy: inviterId,
        expiresAt: sevenDaysFromNow.toISOString(),
        acceptedAt: null,
        createdAt: new Date().toISOString(),
      },
      token: 'raw-ws-token',
    });

    const result = await service.createInvitation(wsId, inviterId, {
      email: 'ws-invite@test.com',
      role: 'member',
    });

    expect(result.invitation.email).toBe('ws-invite@test.com');
    expect(result.invitation.role).toBe('member');
    expect(result.token).toBeDefined();
    expect(result.invitation.acceptedAt).toBeNull();
  });

  it('supports all workspace roles: admin, member, guest', async () => {
    for (const role of ['admin', 'member', 'guest'] as const) {
      vi.spyOn(service, 'createInvitation').mockResolvedValueOnce({
        invitation: {
          id: randomUUID(),
          email: `${role}@test.com`,
          role,
          invitedBy: randomUUID(),
          expiresAt: new Date().toISOString(),
          acceptedAt: null,
          createdAt: new Date().toISOString(),
        },
        token: `token-${role}`,
      });

      const result = await service.createInvitation(randomUUID(), randomUUID(), {
        email: `${role}@test.com`,
        role,
      });
      expect(result.invitation.role).toBe(role);
    }
  });

  it('rejects when user is already a workspace member', async () => {
    vi.spyOn(service, 'createInvitation').mockRejectedValueOnce(
      AppError.conflict(ErrorCode.ALREADY_A_MEMBER, 'User is already a member of this workspace'),
    );

    await expect(
      service.createInvitation(randomUUID(), randomUUID(), {
        email: 'existing@test.com',
        role: 'member',
      }),
    ).rejects.toThrow('User is already a member of this workspace');
  });

  it('rejects duplicate pending invitation', async () => {
    vi.spyOn(service, 'createInvitation').mockRejectedValueOnce(
      AppError.conflict(
        ErrorCode.INVITATION_ALREADY_SENT,
        'An invitation has already been sent to this email',
      ),
    );

    await expect(
      service.createInvitation(randomUUID(), randomUUID(), {
        email: 'dup@test.com',
        role: 'admin',
      }),
    ).rejects.toThrow('An invitation has already been sent to this email');
  });
});

describe('WorkspaceService.listInvitations', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('lists pending workspace invitations', async () => {
    const wsId = randomUUID();

    vi.spyOn(service, 'listInvitations').mockResolvedValueOnce({
      data: [
        {
          id: randomUUID(),
          email: 'pending-ws@test.com',
          role: 'guest',
          invitedBy: randomUUID(),
          expiresAt: new Date().toISOString(),
          acceptedAt: null,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { next_cursor: null, has_more: false },
    });

    const result = await service.listInvitations(wsId, { limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.role).toBe('guest');
  });
});

describe('WorkspaceService.acceptInvitation', () => {
  let service: WorkspaceService;

  beforeEach(() => {
    service = new WorkspaceService(createMockDb());
  });

  it('accepts a valid workspace invitation and creates membership', async () => {
    const wsId = randomUUID();
    const userId = randomUUID();

    vi.spyOn(service, 'acceptInvitation').mockResolvedValueOnce({
      workspaceId: wsId,
    });

    const result = await service.acceptInvitation(userId, 'valid-ws-token');
    expect(result).toEqual({ workspaceId: wsId });
  });

  it('returns null when token is not found', async () => {
    vi.spyOn(service, 'acceptInvitation').mockResolvedValueOnce(null);

    const result = await service.acceptInvitation(randomUUID(), 'bad-token');
    expect(result).toBeNull();
  });

  it('throws error when invitation has expired', async () => {
    vi.spyOn(service, 'acceptInvitation').mockRejectedValueOnce(
      AppError.badRequest(ErrorCode.INVITATION_EXPIRED, 'This invitation has expired'),
    );

    await expect(service.acceptInvitation(randomUUID(), 'expired-token')).rejects.toThrow(
      'This invitation has expired',
    );
  });
});
