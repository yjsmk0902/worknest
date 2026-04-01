import { NodeReaction } from '@worknest/client/types/nodes';

export type NodeReactionListQueryInput = {
  type: 'node.reaction.list';
  nodeId: string;
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'node.reaction.list': {
      input: NodeReactionListQueryInput;
      output: NodeReaction[];
    };
  }
}
