import { describe, expect, it } from 'vitest';

import {
  extractNodeCollaborators,
  extractNodeName,
  extractNodeAvatar,
  extractNodeRole,
} from '@colanode/core/lib/nodes';
import { SpaceAttributes } from '@colanode/core/registry/nodes/space';

describe('nodes', () => {
  const makeSpaceAttributes = (
    overrides?: Partial<SpaceAttributes>
  ): SpaceAttributes => ({
    type: 'space',
    name: 'Test Space',
    collaborators: {},
    ...overrides,
  });

  describe('extractNodeCollaborators', () => {
    it('returns collaborators from a single node', () => {
      const attrs = makeSpaceAttributes({
        collaborators: { user1: 'admin', user2: 'editor' },
      });

      const result = extractNodeCollaborators(attrs);
      expect(result).toEqual({ user1: 'admin', user2: 'editor' });
    });

    it('merges collaborators from multiple nodes', () => {
      const attrs = [
        makeSpaceAttributes({ collaborators: { user1: 'admin' } }),
        makeSpaceAttributes({ collaborators: { user2: 'editor' } }),
      ];

      const result = extractNodeCollaborators(attrs);
      expect(result).toEqual({ user1: 'admin', user2: 'editor' });
    });

    it('returns empty for nodes without collaborators', () => {
      const attrs = { type: 'page' as const, name: 'Test' };
      const result = extractNodeCollaborators(attrs as any);
      expect(result).toEqual({});
    });
  });

  describe('extractNodeName', () => {
    it('extracts name from attributes', () => {
      const attrs = makeSpaceAttributes({ name: 'My Space' });
      expect(extractNodeName(attrs)).toBe('My Space');
    });

    it('returns null when name is missing', () => {
      const attrs = { type: 'record' } as any;
      expect(extractNodeName(attrs)).toBeNull();
    });
  });

  describe('extractNodeAvatar', () => {
    it('extracts avatar from attributes', () => {
      const attrs = makeSpaceAttributes({ avatar: 'avatar-id-123' });
      expect(extractNodeAvatar(attrs)).toBe('avatar-id-123');
    });

    it('returns null when avatar is missing', () => {
      const attrs = makeSpaceAttributes();
      expect(extractNodeAvatar(attrs)).toBeNull();
    });
  });

  describe('extractNodeRole', () => {
    it('returns role for matching collaborator', () => {
      const node = {
        id: 'node1',
        rootId: 'root1',
        parentId: null,
        createdAt: '2024-01-01',
        createdBy: 'user1',
        updatedAt: null,
        updatedBy: null,
        ...makeSpaceAttributes({ collaborators: { user1: 'admin' } }),
      };

      expect(extractNodeRole(node, 'user1')).toBe('admin');
    });

    it('returns null for non-matching collaborator', () => {
      const node = {
        id: 'node1',
        rootId: 'root1',
        parentId: null,
        createdAt: '2024-01-01',
        createdBy: 'user1',
        updatedAt: null,
        updatedBy: null,
        ...makeSpaceAttributes({ collaborators: { user1: 'admin' } }),
      };

      expect(extractNodeRole(node, 'user2')).toBeNull();
    });

    it('uses last matching role from array of nodes', () => {
      const nodes = [
        {
          id: 'node1',
          rootId: 'root1',
          parentId: null,
          createdAt: '2024-01-01',
          createdBy: 'user1',
          updatedAt: null,
          updatedBy: null,
          ...makeSpaceAttributes({
            collaborators: { user1: 'viewer' as const },
          }),
        },
        {
          id: 'node2',
          rootId: 'root1',
          parentId: 'node1',
          createdAt: '2024-01-01',
          createdBy: 'user1',
          updatedAt: null,
          updatedBy: null,
          ...makeSpaceAttributes({
            collaborators: { user1: 'admin' as const },
          }),
        },
      ];

      expect(extractNodeRole(nodes, 'user1')).toBe('admin');
    });
  });
});
