import { describe, expect, it } from 'vitest';

import { hasNodeRole, hasWorkspaceRole } from '@worknest/core/lib/permissions';

describe('permissions', () => {
  describe('hasWorkspaceRole', () => {
    it('owner satisfies all roles', () => {
      expect(hasWorkspaceRole('owner', 'owner')).toBe(true);
      expect(hasWorkspaceRole('owner', 'admin')).toBe(true);
      expect(hasWorkspaceRole('owner', 'collaborator')).toBe(true);
      expect(hasWorkspaceRole('owner', 'guest')).toBe(true);
    });

    it('admin satisfies admin and below but not owner', () => {
      expect(hasWorkspaceRole('admin', 'owner')).toBe(false);
      expect(hasWorkspaceRole('admin', 'admin')).toBe(true);
      expect(hasWorkspaceRole('admin', 'collaborator')).toBe(true);
      expect(hasWorkspaceRole('admin', 'guest')).toBe(true);
    });

    it('collaborator satisfies collaborator and guest but not admin', () => {
      expect(hasWorkspaceRole('collaborator', 'owner')).toBe(false);
      expect(hasWorkspaceRole('collaborator', 'admin')).toBe(false);
      expect(hasWorkspaceRole('collaborator', 'collaborator')).toBe(true);
      expect(hasWorkspaceRole('collaborator', 'guest')).toBe(true);
    });

    it('guest satisfies only guest', () => {
      expect(hasWorkspaceRole('guest', 'owner')).toBe(false);
      expect(hasWorkspaceRole('guest', 'admin')).toBe(false);
      expect(hasWorkspaceRole('guest', 'collaborator')).toBe(false);
      expect(hasWorkspaceRole('guest', 'guest')).toBe(true);
    });
  });

  describe('hasNodeRole', () => {
    it('admin satisfies all node roles', () => {
      expect(hasNodeRole('admin', 'admin')).toBe(true);
      expect(hasNodeRole('admin', 'editor')).toBe(true);
      expect(hasNodeRole('admin', 'collaborator')).toBe(true);
      expect(hasNodeRole('admin', 'viewer')).toBe(true);
    });

    it('editor satisfies editor and below but not admin', () => {
      expect(hasNodeRole('editor', 'admin')).toBe(false);
      expect(hasNodeRole('editor', 'editor')).toBe(true);
      expect(hasNodeRole('editor', 'collaborator')).toBe(true);
      expect(hasNodeRole('editor', 'viewer')).toBe(true);
    });

    it('collaborator satisfies collaborator and viewer', () => {
      expect(hasNodeRole('collaborator', 'admin')).toBe(false);
      expect(hasNodeRole('collaborator', 'editor')).toBe(false);
      expect(hasNodeRole('collaborator', 'collaborator')).toBe(true);
      expect(hasNodeRole('collaborator', 'viewer')).toBe(true);
    });

    it('viewer satisfies only viewer', () => {
      expect(hasNodeRole('viewer', 'admin')).toBe(false);
      expect(hasNodeRole('viewer', 'editor')).toBe(false);
      expect(hasNodeRole('viewer', 'collaborator')).toBe(false);
      expect(hasNodeRole('viewer', 'viewer')).toBe(true);
    });
  });
});
