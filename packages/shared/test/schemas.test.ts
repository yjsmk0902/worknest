/**
 * Shared schema validation tests.
 *
 * Tests all Zod schemas exported from @worknest/shared to verify:
 * - Valid data passes validation
 * - Invalid data is correctly rejected
 * - Edge cases (max lengths, special characters, UUID format, etc.)
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  acceptInvitationParams,
  createOrgInvitationInput,
  createOrganizationInput,
  createWorkspaceInput,
  createWsInvitationInput,
  // Common schemas
  cursorPaginationQuery,
  dataResponse,
  errorResponse,
  invitationOutput,
  listResponse,
  loginInput,
  orgMemberOutput,
  // Organization schemas
  orgRole,
  organizationOutput,
  paginationMeta,
  // Auth schemas
  registerInput,
  slugSchema,
  updateOrgMemberInput,
  updateOrganizationInput,
  updateProfileInput,
  updateWorkspaceInput,
  updateWsMemberInput,
  uuidParam,
  workspaceOutput,
  wsMemberOutput,
  // Workspace schemas
  wsRole,
} from '../src/index';

// ═══════════════════════════════════════════════════════════════════════
// Auth Schemas
// ═══════════════════════════════════════════════════════════════════════

describe('registerInput schema', () => {
  it('accepts valid registration data', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      name: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = registerInput.safeParse({
      password: 'secure123',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = registerInput.safeParse({
      email: 'not-an-email',
      password: 'secure123',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'short',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password longer than 128 characters', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(129),
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('accepts password at minimum length (8)', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: '12345678',
      name: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('accepts password at maximum length (128)', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(128),
      name: 'Test User',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('accepts name at maximum length (100)', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'secure123',
      name: 'a'.repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing password', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = registerInput.safeParse({
      email: 'user@example.com',
      password: 'secure123',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginInput schema', () => {
  it('accepts valid login data', () => {
    const result = loginInput.safeParse({
      email: 'user@example.com',
      password: 'any-password',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = loginInput.safeParse({
      password: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = loginInput.safeParse({
      email: 'invalid',
      password: 'password',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginInput.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts any non-empty password (no min length for login)', () => {
    const result = loginInput.safeParse({
      email: 'user@example.com',
      password: 'a',
    });
    expect(result.success).toBe(true);
  });
});

describe('acceptInvitationParams schema', () => {
  it('accepts a non-empty token', () => {
    const result = acceptInvitationParams.safeParse({
      token: 'abc123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty token', () => {
    const result = acceptInvitationParams.safeParse({
      token: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing token', () => {
    const result = acceptInvitationParams.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('updateProfileInput schema', () => {
  it('accepts valid profile update with name', () => {
    const result = updateProfileInput.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid profile update with avatarUrl', () => {
    const result = updateProfileInput.safeParse({
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null avatarUrl (to remove avatar)', () => {
    const result = updateProfileInput.safeParse({
      avatarUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no changes)', () => {
    const result = updateProfileInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects name longer than 100 characters', () => {
    const result = updateProfileInput.safeParse({
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = updateProfileInput.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts any avatarUrl string', () => {
    const result = updateProfileInput.safeParse({
      avatarUrl: '/api/v1/files/123/serve',
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Common Schemas
// ═══════════════════════════════════════════════════════════════════════

describe('cursorPaginationQuery schema', () => {
  it('accepts valid pagination with cursor and limit', () => {
    const result = cursorPaginationQuery.safeParse({
      cursor: 'some-cursor-id',
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('accepts pagination without cursor (first page)', () => {
    const result = cursorPaginationQuery.safeParse({
      limit: 20,
    });
    expect(result.success).toBe(true);
  });

  it('applies default limit of 20 when not provided', () => {
    const result = cursorPaginationQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it('rejects limit less than 1', () => {
    const result = cursorPaginationQuery.safeParse({
      limit: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects limit greater than 100', () => {
    const result = cursorPaginationQuery.safeParse({
      limit: 101,
    });
    expect(result.success).toBe(false);
  });

  it('accepts limit at minimum (1)', () => {
    const result = cursorPaginationQuery.safeParse({ limit: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts limit at maximum (100)', () => {
    const result = cursorPaginationQuery.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
  });

  it('coerces string limit to number', () => {
    const result = cursorPaginationQuery.safeParse({ limit: '25' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it('rejects non-integer limit', () => {
    const result = cursorPaginationQuery.safeParse({ limit: 10.5 });
    expect(result.success).toBe(false);
  });
});

describe('paginationMeta schema', () => {
  it('accepts valid pagination meta', () => {
    const result = paginationMeta.safeParse({
      next_cursor: 'cursor-123',
      has_more: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null next_cursor when no more pages', () => {
    const result = paginationMeta.safeParse({
      next_cursor: null,
      has_more: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('errorResponse schema', () => {
  it('accepts valid error response', () => {
    const result = errorResponse.safeParse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts error response with details', () => {
    const result = errorResponse.safeParse({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          fields: [{ path: 'email', message: 'Invalid email' }],
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects error response without code', () => {
    const result = errorResponse.safeParse({
      error: {
        message: 'Something went wrong',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects error response without message', () => {
    const result = errorResponse.safeParse({
      error: {
        code: 'INTERNAL_ERROR',
      },
    });
    expect(result.success).toBe(false);
  });
});

describe('uuidParam schema', () => {
  it('accepts a valid UUID', () => {
    const result = uuidParam.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid UUID format', () => {
    const result = uuidParam.safeParse({
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = uuidParam.safeParse({
      id: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = uuidParam.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects partial UUID', () => {
    const result = uuidParam.safeParse({
      id: '550e8400-e29b',
    });
    expect(result.success).toBe(false);
  });
});

describe('slugSchema', () => {
  it('accepts a valid lowercase slug', () => {
    const result = slugSchema.safeParse('my-org');
    expect(result.success).toBe(true);
  });

  it('accepts a slug with numbers', () => {
    const result = slugSchema.safeParse('org-123');
    expect(result.success).toBe(true);
  });

  it('accepts a slug without hyphens', () => {
    const result = slugSchema.safeParse('myorg');
    expect(result.success).toBe(true);
  });

  it('rejects a slug shorter than 2 characters', () => {
    const result = slugSchema.safeParse('a');
    expect(result.success).toBe(false);
  });

  it('rejects a slug longer than 50 characters', () => {
    const result = slugSchema.safeParse('a'.repeat(51));
    expect(result.success).toBe(false);
  });

  it('accepts slug at minimum length (2)', () => {
    const result = slugSchema.safeParse('ab');
    expect(result.success).toBe(true);
  });

  it('accepts slug at maximum length (50)', () => {
    const result = slugSchema.safeParse('a'.repeat(50));
    expect(result.success).toBe(true);
  });

  it('rejects uppercase characters', () => {
    const result = slugSchema.safeParse('My-Org');
    expect(result.success).toBe(false);
  });

  it('rejects special characters', () => {
    const result = slugSchema.safeParse('my_org');
    expect(result.success).toBe(false);
  });

  it('rejects spaces', () => {
    const result = slugSchema.safeParse('my org');
    expect(result.success).toBe(false);
  });

  it('rejects leading hyphen', () => {
    const result = slugSchema.safeParse('-my-org');
    expect(result.success).toBe(false);
  });

  it('rejects trailing hyphen', () => {
    const result = slugSchema.safeParse('my-org-');
    expect(result.success).toBe(false);
  });

  it('rejects consecutive hyphens', () => {
    const result = slugSchema.safeParse('my--org');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = slugSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('accepts purely numeric slug', () => {
    const result = slugSchema.safeParse('12345');
    expect(result.success).toBe(true);
  });
});

describe('dataResponse wrapper', () => {
  it('wraps a schema in { data: T } envelope', () => {
    const wrapped = dataResponse(z.object({ id: z.string() }));
    const result = wrapped.safeParse({ data: { id: '123' } });
    expect(result.success).toBe(true);
  });

  it('rejects when data key is missing', () => {
    const wrapped = dataResponse(z.object({ id: z.string() }));
    const result = wrapped.safeParse({ id: '123' });
    expect(result.success).toBe(false);
  });
});

describe('listResponse wrapper', () => {
  it('wraps items in { data: T[], pagination } envelope', () => {
    const wrapped = listResponse(z.object({ id: z.string() }));
    const result = wrapped.safeParse({
      data: [{ id: '1' }, { id: '2' }],
      pagination: { next_cursor: null, has_more: false },
    });
    expect(result.success).toBe(true);
  });

  it('rejects when pagination is missing', () => {
    const wrapped = listResponse(z.object({ id: z.string() }));
    const result = wrapped.safeParse({
      data: [{ id: '1' }],
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Organization Schemas
// ═══════════════════════════════════════════════════════════════════════

describe('orgRole schema', () => {
  it("accepts 'owner'", () => {
    expect(orgRole.safeParse('owner').success).toBe(true);
  });

  it("accepts 'admin'", () => {
    expect(orgRole.safeParse('admin').success).toBe(true);
  });

  it("accepts 'member'", () => {
    expect(orgRole.safeParse('member').success).toBe(true);
  });

  it("rejects 'guest'", () => {
    expect(orgRole.safeParse('guest').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(orgRole.safeParse('').success).toBe(false);
  });
});

describe('createOrganizationInput schema', () => {
  it('accepts valid input with all fields', () => {
    const result = createOrganizationInput.safeParse({
      name: 'My Organization',
      slug: 'my-org',
      logo: 'https://example.com/logo.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts input without optional logo', () => {
    const result = createOrganizationInput.safeParse({
      name: 'My Organization',
      slug: 'my-org',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null logo', () => {
    const result = createOrganizationInput.safeParse({
      name: 'My Organization',
      slug: 'my-org',
      logo: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createOrganizationInput.safeParse({
      slug: 'my-org',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createOrganizationInput.safeParse({
      name: '',
      slug: 'my-org',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = createOrganizationInput.safeParse({
      name: 'a'.repeat(101),
      slug: 'my-org',
    });
    expect(result.success).toBe(false);
  });

  it('accepts name-only input (slug auto-generated)', () => {
    const result = createOrganizationInput.safeParse({
      name: 'My Organization',
    });
    expect(result.success).toBe(true);
  });
});

describe('updateOrganizationInput schema', () => {
  it('accepts partial update with name only', () => {
    const result = updateOrganizationInput.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with slug only', () => {
    const result = updateOrganizationInput.safeParse({
      slug: 'new-slug',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no fields to update)', () => {
    const result = updateOrganizationInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length', () => {
    const result = updateOrganizationInput.safeParse({
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe('organizationOutput schema', () => {
  it('accepts valid organization output', () => {
    const result = organizationOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'My Org',
      slug: 'my-org',
      tag: 'ABCDEFGHIJKLMNO',
      description: null,
      logo: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects output with invalid UUID id', () => {
    const result = organizationOutput.safeParse({
      id: 'not-uuid',
      name: 'My Org',
      slug: 'my-org',
      logo: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('createOrgInvitationInput schema', () => {
  it('accepts valid invitation with admin role', () => {
    const result = createOrgInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'admin',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid invitation with member role', () => {
    const result = createOrgInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'member',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invitation with owner role', () => {
    const result = createOrgInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'owner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createOrgInvitationInput.safeParse({
      email: 'not-email',
      role: 'member',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing role', () => {
    const result = createOrgInvitationInput.safeParse({
      email: 'invite@example.com',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateOrgMemberInput schema', () => {
  it('accepts valid role update', () => {
    const result = updateOrgMemberInput.safeParse({ role: 'admin' });
    expect(result.success).toBe(true);
  });

  it('accepts owner role (validation is at service level)', () => {
    const result = updateOrgMemberInput.safeParse({ role: 'owner' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = updateOrgMemberInput.safeParse({ role: 'superadmin' });
    expect(result.success).toBe(false);
  });
});

describe('invitationOutput schema', () => {
  it('accepts valid invitation output', () => {
    const result = invitationOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      role: 'member',
      invitedBy: '550e8400-e29b-41d4-a716-446655440001',
      expiresAt: '2024-01-08T00:00:00.000Z',
      acceptedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts invitation with null invitedBy', () => {
    const result = invitationOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'user@example.com',
      role: 'admin',
      invitedBy: null,
      expiresAt: '2024-01-08T00:00:00.000Z',
      acceptedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Workspace Schemas
// ═══════════════════════════════════════════════════════════════════════

describe('wsRole schema', () => {
  it("accepts 'admin'", () => {
    expect(wsRole.safeParse('admin').success).toBe(true);
  });

  it("accepts 'member'", () => {
    expect(wsRole.safeParse('member').success).toBe(true);
  });

  it("accepts 'guest'", () => {
    expect(wsRole.safeParse('guest').success).toBe(true);
  });

  it("rejects 'owner'", () => {
    expect(wsRole.safeParse('owner').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(wsRole.safeParse('').success).toBe(false);
  });
});

describe('createWorkspaceInput schema', () => {
  it('accepts valid input with all fields', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'My Workspace',
      slug: 'my-ws',
      logo: 'https://example.com/logo.png',
      description: 'A test workspace',
    });
    expect(result.success).toBe(true);
  });

  it('accepts input without optional fields', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'My Workspace',
      slug: 'my-ws',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null description', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'My Workspace',
      slug: 'my-ws',
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = createWorkspaceInput.safeParse({
      slug: 'my-ws',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createWorkspaceInput.safeParse({
      name: '',
      slug: 'my-ws',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 100 characters', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'a'.repeat(101),
      slug: 'my-ws',
    });
    expect(result.success).toBe(false);
  });

  it('accepts name-only input (slug auto-generated)', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'My Workspace',
    });
    expect(result.success).toBe(true);
  });

  it('rejects description longer than 500 characters', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'My Workspace',
      slug: 'my-ws',
      description: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts description at maximum length (500)', () => {
    const result = createWorkspaceInput.safeParse({
      name: 'My Workspace',
      slug: 'my-ws',
      description: 'a'.repeat(500),
    });
    expect(result.success).toBe(true);
  });
});

describe('updateWorkspaceInput schema', () => {
  it('accepts partial update with name only', () => {
    const result = updateWorkspaceInput.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('accepts partial update with description only', () => {
    const result = updateWorkspaceInput.safeParse({
      description: 'Updated description',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (no fields to update)', () => {
    const result = updateWorkspaceInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects name exceeding max length', () => {
    const result = updateWorkspaceInput.safeParse({
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('accepts setting description to null', () => {
    const result = updateWorkspaceInput.safeParse({
      description: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('workspaceOutput schema', () => {
  it('accepts valid workspace output', () => {
    const result = workspaceOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      orgId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'My WS',
      slug: 'my-ws',
      logo: null,
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects output with invalid orgId UUID', () => {
    const result = workspaceOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      orgId: 'not-a-uuid',
      name: 'My WS',
      slug: 'my-ws',
      logo: null,
      description: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('createWsInvitationInput schema', () => {
  it('accepts valid invitation with admin role', () => {
    const result = createWsInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'admin',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid invitation with member role', () => {
    const result = createWsInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'member',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid invitation with guest role', () => {
    const result = createWsInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'guest',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invitation with owner role (not valid for workspaces)', () => {
    const result = createWsInvitationInput.safeParse({
      email: 'invite@example.com',
      role: 'owner',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createWsInvitationInput.safeParse({
      email: 'bad',
      role: 'member',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateWsMemberInput schema', () => {
  it('accepts valid workspace role update', () => {
    const result = updateWsMemberInput.safeParse({ role: 'guest' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role for workspace', () => {
    const result = updateWsMemberInput.safeParse({ role: 'owner' });
    expect(result.success).toBe(false);
  });
});

describe('wsMemberOutput schema', () => {
  it('accepts valid workspace member output', () => {
    const result = wsMemberOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      role: 'admin',
      joinedAt: '2024-01-01T00:00:00.000Z',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: null,
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('orgMemberOutput schema', () => {
  it('accepts valid org member output', () => {
    const result = orgMemberOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      orgId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      role: 'owner',
      joinedAt: '2024-01-01T00:00:00.000Z',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects org member with invalid role', () => {
    const result = orgMemberOutput.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      orgId: '550e8400-e29b-41d4-a716-446655440001',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      role: 'superadmin',
      joinedAt: '2024-01-01T00:00:00.000Z',
      user: {
        id: '550e8400-e29b-41d4-a716-446655440002',
        email: 'user@example.com',
        name: 'Test User',
        avatarUrl: null,
      },
    });
    expect(result.success).toBe(false);
  });
});
