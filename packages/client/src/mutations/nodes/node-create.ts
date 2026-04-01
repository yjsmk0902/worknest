import { NodeAttributes } from '@worknest/core';

export type NodeCreateMutationInput = {
  type: 'node.create';
  userId: string;
  nodeId: string;
  attributes: NodeAttributes;
};

export type NodeCreateMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'node.create': {
      input: NodeCreateMutationInput;
      output: NodeCreateMutationOutput;
    };
  }
}
