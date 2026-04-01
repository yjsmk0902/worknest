export type NodeInteractionSeenMutationInput = {
  type: 'node.interaction.seen';
  userId: string;
  nodeId: string;
};

export type NodeInteractionSeenMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'node.interaction.seen': {
      input: NodeInteractionSeenMutationInput;
      output: NodeInteractionSeenMutationOutput;
    };
  }
}
