import { NodeAttributes } from '@worknest/core';

export type NodeUpdateMutationInput = {
  type: 'node.update';
  userId: string;
  nodeId: string;
  attributes: NodeAttributes;
};

export type NodeUpdateMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'node.update': {
      input: NodeUpdateMutationInput;
      output: NodeUpdateMutationOutput;
    };
  }
}
