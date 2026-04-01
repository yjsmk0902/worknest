import { describe, expect, it } from 'vitest';

import { getNodeModel, NodeType } from '@worknest/core/registry/nodes';
import { spaceModel } from '@worknest/core/registry/nodes/space';
import { CanCreateNodeContext } from '@worknest/core/registry/nodes/core';

describe('node registry', () => {
  describe('getNodeModel', () => {
    const allTypes: NodeType[] = [
      'channel',
      'chat',
      'database',
      'database_view',
      'folder',
      'page',
      'record',
      'space',
      'message',
      'file',
    ];

    it('returns a model for every registered node type', () => {
      for (const type of allTypes) {
        const model = getNodeModel(type);
        expect(model).toBeDefined();
        expect(model.type).toBe(type);
      }
    });

    it('returns model with required interface methods', () => {
      for (const type of allTypes) {
        const model = getNodeModel(type);
        expect(typeof model.canCreate).toBe('function');
        expect(typeof model.canUpdateAttributes).toBe('function');
        expect(typeof model.canUpdateDocument).toBe('function');
        expect(typeof model.canDelete).toBe('function');
        expect(typeof model.canReact).toBe('function');
        expect(typeof model.extractText).toBe('function');
        expect(typeof model.extractMentions).toBe('function');
        expect(model.attributesSchema).toBeDefined();
      }
    });
  });

  describe('spaceModel permissions', () => {
    const makeUser = (overrides?: Record<string, unknown>) => ({
      id: 'user1',
      role: 'collaborator' as const,
      workspaceId: 'ws1',
      accountId: 'acc1',
      ...overrides,
    });

    it('canCreate: allows collaborator creating space with self as admin', () => {
      const context: CanCreateNodeContext = {
        user: makeUser(),
        tree: [],
        attributes: {
          type: 'space',
          name: 'Test',
          collaborators: { user1: 'admin' },
        },
      };
      expect(spaceModel.canCreate(context)).toBe(true);
    });

    it('canCreate: rejects when tree is not empty', () => {
      const context: CanCreateNodeContext = {
        user: makeUser(),
        tree: [
          {
            id: 'existing',
            rootId: 'root',
            parentId: null,
            createdAt: '2024-01-01',
            createdBy: 'user1',
            updatedAt: null,
            updatedBy: null,
            type: 'space',
            name: 'Existing',
            collaborators: { user1: 'admin' },
          },
        ],
        attributes: {
          type: 'space',
          name: 'Test',
          collaborators: { user1: 'admin' },
        },
      };
      expect(spaceModel.canCreate(context)).toBe(false);
    });

    it('canCreate: rejects when user is guest', () => {
      const context: CanCreateNodeContext = {
        user: makeUser({ role: 'guest' }),
        tree: [],
        attributes: {
          type: 'space',
          name: 'Test',
          collaborators: { user1: 'admin' },
        },
      };
      expect(spaceModel.canCreate(context)).toBe(false);
    });

    it('canCreate: rejects when no collaborators', () => {
      const context: CanCreateNodeContext = {
        user: makeUser(),
        tree: [],
        attributes: {
          type: 'space',
          name: 'Test',
          collaborators: {},
        },
      };
      expect(spaceModel.canCreate(context)).toBe(false);
    });

    it('canCreate: rejects when user is not admin collaborator', () => {
      const context: CanCreateNodeContext = {
        user: makeUser(),
        tree: [],
        attributes: {
          type: 'space',
          name: 'Test',
          collaborators: { user1: 'editor' },
        },
      };
      expect(spaceModel.canCreate(context)).toBe(false);
    });

    it('canUpdateDocument: always returns false for spaces', () => {
      expect(spaceModel.canUpdateDocument({} as any)).toBe(false);
    });

    it('canReact: always returns false for spaces', () => {
      expect(spaceModel.canReact({} as any)).toBe(false);
    });

    it('extractText: returns name from space attributes', () => {
      const result = spaceModel.extractText('id1', {
        type: 'space',
        name: 'My Space',
        collaborators: {},
      });
      expect(result).toEqual({ name: 'My Space', attributes: null });
    });

    it('extractMentions: always returns empty array', () => {
      const result = spaceModel.extractMentions('id1', {
        type: 'space',
        name: 'Test',
        collaborators: {},
      });
      expect(result).toEqual([]);
    });
  });
});
