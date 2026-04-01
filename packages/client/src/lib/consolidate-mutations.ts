import { Mutation } from '@worknest/core';

export const consolidateMutations = (mutations: Mutation[]) => {
  const validMutations: Mutation[] = [];
  const deletedMutationIds: Set<string> = new Set();

  for (let i = mutations.length - 1; i >= 0; i--) {
    const mutation = mutations[i];
    if (!mutation) {
      continue;
    }

    if (deletedMutationIds.has(mutation.id)) {
      continue;
    }

    if (mutation.type === 'node.delete') {
      for (let j = i - 1; j >= 0; j--) {
        const previousMutation = mutations[j];
        if (!previousMutation) {
          continue;
        }

        if (
          previousMutation.type === 'node.create' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(mutation.id);
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.update' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(mutation.id);
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.delete' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'document.update' &&
          previousMutation.data.documentId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.interaction.seen' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.interaction.opened' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.reaction.create' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.reaction.delete' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        }
      }
    } else if (mutation.type === 'node.reaction.delete') {
      for (let j = i - 1; j >= 0; j--) {
        const previousMutation = mutations[j];
        if (!previousMutation) {
          continue;
        }

        if (
          previousMutation.type === 'node.reaction.create' &&
          previousMutation.data.nodeId === mutation.data.nodeId &&
          previousMutation.data.reaction === mutation.data.reaction
        ) {
          deletedMutationIds.add(mutation.id);
          deletedMutationIds.add(previousMutation.id);
        } else if (
          previousMutation.type === 'node.reaction.delete' &&
          previousMutation.data.nodeId === mutation.data.nodeId &&
          previousMutation.data.reaction === mutation.data.reaction
        ) {
          deletedMutationIds.add(previousMutation.id);
        }
      }
    } else if (mutation.type === 'node.interaction.seen') {
      for (let j = i - 1; j >= 0; j--) {
        const previousMutation = mutations[j];
        if (!previousMutation) {
          continue;
        }

        if (
          previousMutation.type === 'node.interaction.seen' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        }
      }
    } else if (mutation.type === 'node.interaction.opened') {
      for (let j = i - 1; j >= 0; j--) {
        const previousMutation = mutations[j];
        if (!previousMutation) {
          continue;
        }

        if (
          previousMutation.type === 'node.interaction.opened' &&
          previousMutation.data.nodeId === mutation.data.nodeId
        ) {
          deletedMutationIds.add(previousMutation.id);
        }
      }
    }

    if (!deletedMutationIds.has(mutation.id)) {
      validMutations.push(mutation);
    }
  }

  return {
    validMutations: validMutations.reverse(),
    deletedMutationIds,
  };
};
