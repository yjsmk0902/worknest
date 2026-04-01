import { describe, expect, it } from 'vitest';

import { consolidateMutations } from '@colanode/client/lib/consolidate-mutations';
import { Mutation } from '@colanode/core';

const makeMutation = (
  id: string,
  type: Mutation['type'],
  data: Record<string, unknown>
): Mutation =>
  ({
    id,
    type,
    createdAt: new Date().toISOString(),
    data,
  }) as unknown as Mutation;

describe('consolidateMutations', () => {
  it('returns all mutations when nothing can be consolidated', () => {
    const mutations = [
      makeMutation('m1', 'node.create', {
        nodeId: 'n1',
        updateId: 'u1',
        createdAt: '2024-01-01',
        data: '',
      }),
      makeMutation('m2', 'node.create', {
        nodeId: 'n2',
        updateId: 'u2',
        createdAt: '2024-01-01',
        data: '',
      }),
    ];

    const { validMutations, deletedMutationIds } =
      consolidateMutations(mutations);
    expect(validMutations).toHaveLength(2);
    expect(deletedMutationIds.size).toBe(0);
  });

  it('returns empty result for empty input', () => {
    const { validMutations, deletedMutationIds } = consolidateMutations([]);
    expect(validMutations).toHaveLength(0);
    expect(deletedMutationIds.size).toBe(0);
  });

  describe('node.delete consolidation', () => {
    it('cancels both create and delete for the same node', () => {
      const mutations = [
        makeMutation('m1', 'node.create', {
          nodeId: 'n1',
          updateId: 'u1',
          createdAt: '2024-01-01',
          data: '',
        }),
        makeMutation('m2', 'node.delete', { nodeId: 'n1' }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(0);
      expect(deletedMutationIds.has('m1')).toBe(true);
      expect(deletedMutationIds.has('m2')).toBe(true);
    });

    it('cancels update and delete for the same node', () => {
      const mutations = [
        makeMutation('m1', 'node.update', {
          nodeId: 'n1',
          updateId: 'u1',
          data: '',
        }),
        makeMutation('m2', 'node.delete', { nodeId: 'n1' }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(0);
      expect(deletedMutationIds.has('m1')).toBe(true);
      expect(deletedMutationIds.has('m2')).toBe(true);
    });

    it('keeps only the latest delete when multiple deletes exist', () => {
      const mutations = [
        makeMutation('m1', 'node.delete', { nodeId: 'n1' }),
        makeMutation('m2', 'node.delete', { nodeId: 'n1' }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(1);
      expect(validMutations[0]!.id).toBe('m2');
      expect(deletedMutationIds.has('m1')).toBe(true);
    });

    it('removes related interactions when node is deleted', () => {
      const mutations = [
        makeMutation('m1', 'node.interaction.seen', {
          nodeId: 'n1',
          seenAt: '2024-01-01',
        }),
        makeMutation('m2', 'node.interaction.opened', {
          nodeId: 'n1',
          openedAt: '2024-01-01',
        }),
        makeMutation('m3', 'node.delete', { nodeId: 'n1' }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(deletedMutationIds.has('m1')).toBe(true);
      expect(deletedMutationIds.has('m2')).toBe(true);
    });

    it('removes related reactions when node is deleted', () => {
      const mutations = [
        makeMutation('m1', 'node.reaction.create', {
          nodeId: 'n1',
          reaction: '👍',
        }),
        makeMutation('m2', 'node.reaction.delete', {
          nodeId: 'n1',
          reaction: '👎',
        }),
        makeMutation('m3', 'node.delete', { nodeId: 'n1' }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(deletedMutationIds.has('m1')).toBe(true);
      expect(deletedMutationIds.has('m2')).toBe(true);
    });

    it('removes document.update when its node is deleted', () => {
      const mutations = [
        makeMutation('m1', 'document.update', {
          documentId: 'n1',
          updateId: 'u1',
          data: '',
          createdAt: '2024-01-01',
        }),
        makeMutation('m2', 'node.delete', { nodeId: 'n1' }),
      ];

      const { deletedMutationIds } = consolidateMutations(mutations);
      expect(deletedMutationIds.has('m1')).toBe(true);
    });

    it('does not remove document.update for a different node', () => {
      const mutations = [
        makeMutation('m1', 'document.update', {
          documentId: 'n2',
          updateId: 'u1',
          data: '',
          createdAt: '2024-01-01',
        }),
        makeMutation('m2', 'node.delete', { nodeId: 'n1' }),
      ];

      const { deletedMutationIds } = consolidateMutations(mutations);
      expect(deletedMutationIds.has('m1')).toBe(false);
    });

    it('does not affect mutations for different nodes', () => {
      const mutations = [
        makeMutation('m1', 'node.create', {
          nodeId: 'n1',
          updateId: 'u1',
          createdAt: '2024-01-01',
          data: '',
        }),
        makeMutation('m2', 'node.create', {
          nodeId: 'n2',
          updateId: 'u2',
          createdAt: '2024-01-01',
          data: '',
        }),
        makeMutation('m3', 'node.delete', { nodeId: 'n1' }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(1);
      expect(validMutations[0]!.id).toBe('m2');
      expect(deletedMutationIds.has('m1')).toBe(true);
      expect(deletedMutationIds.has('m3')).toBe(true);
    });
  });

  describe('reaction consolidation', () => {
    it('cancels reaction create and delete for the same node and reaction', () => {
      const mutations = [
        makeMutation('m1', 'node.reaction.create', {
          nodeId: 'n1',
          reaction: '👍',
        }),
        makeMutation('m2', 'node.reaction.delete', {
          nodeId: 'n1',
          reaction: '👍',
        }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(0);
      expect(deletedMutationIds.has('m1')).toBe(true);
      expect(deletedMutationIds.has('m2')).toBe(true);
    });

    it('does not cancel reaction create/delete for different reactions', () => {
      const mutations = [
        makeMutation('m1', 'node.reaction.create', {
          nodeId: 'n1',
          reaction: '👍',
        }),
        makeMutation('m2', 'node.reaction.delete', {
          nodeId: 'n1',
          reaction: '👎',
        }),
      ];

      const { validMutations } = consolidateMutations(mutations);
      expect(validMutations).toHaveLength(2);
    });

    it('keeps only the latest reaction delete', () => {
      const mutations = [
        makeMutation('m1', 'node.reaction.delete', {
          nodeId: 'n1',
          reaction: '👍',
        }),
        makeMutation('m2', 'node.reaction.delete', {
          nodeId: 'n1',
          reaction: '👍',
        }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(1);
      expect(validMutations[0]!.id).toBe('m2');
      expect(deletedMutationIds.has('m1')).toBe(true);
    });
  });

  describe('interaction consolidation', () => {
    it('deduplicates seen interactions for the same node', () => {
      const mutations = [
        makeMutation('m1', 'node.interaction.seen', {
          nodeId: 'n1',
          seenAt: '2024-01-01',
        }),
        makeMutation('m2', 'node.interaction.seen', {
          nodeId: 'n1',
          seenAt: '2024-01-02',
        }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(1);
      expect(validMutations[0]!.id).toBe('m2');
      expect(deletedMutationIds.has('m1')).toBe(true);
    });

    it('deduplicates opened interactions for the same node', () => {
      const mutations = [
        makeMutation('m1', 'node.interaction.opened', {
          nodeId: 'n1',
          openedAt: '2024-01-01',
        }),
        makeMutation('m2', 'node.interaction.opened', {
          nodeId: 'n1',
          openedAt: '2024-01-02',
        }),
      ];

      const { validMutations, deletedMutationIds } =
        consolidateMutations(mutations);
      expect(validMutations).toHaveLength(1);
      expect(validMutations[0]!.id).toBe('m2');
      expect(deletedMutationIds.has('m1')).toBe(true);
    });

    it('does not deduplicate interactions for different nodes', () => {
      const mutations = [
        makeMutation('m1', 'node.interaction.seen', {
          nodeId: 'n1',
          seenAt: '2024-01-01',
        }),
        makeMutation('m2', 'node.interaction.seen', {
          nodeId: 'n2',
          seenAt: '2024-01-02',
        }),
      ];

      const { validMutations } = consolidateMutations(mutations);
      expect(validMutations).toHaveLength(2);
    });
  });

  describe('ordering', () => {
    it('preserves original order of valid mutations', () => {
      const mutations = [
        makeMutation('m1', 'node.create', {
          nodeId: 'n1',
          updateId: 'u1',
          createdAt: '2024-01-01',
          data: '',
        }),
        makeMutation('m2', 'node.update', {
          nodeId: 'n1',
          updateId: 'u2',
          data: '',
        }),
        makeMutation('m3', 'node.create', {
          nodeId: 'n2',
          updateId: 'u3',
          createdAt: '2024-01-01',
          data: '',
        }),
      ];

      const { validMutations } = consolidateMutations(mutations);
      expect(validMutations.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    });
  });
});
