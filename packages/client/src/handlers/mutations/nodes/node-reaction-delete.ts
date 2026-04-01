import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  NodeReactionDeleteMutationInput,
  NodeReactionDeleteMutationOutput,
} from '@worknest/client/mutations/nodes/node-reaction-delete';

export class NodeReactionDeleteMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<NodeReactionDeleteMutationInput>
{
  async handleMutation(
    input: NodeReactionDeleteMutationInput
  ): Promise<NodeReactionDeleteMutationOutput> {
    const workspace = this.getWorkspace(input.userId);
    await workspace.nodeReactions.deleteNodeReaction(
      input.nodeId,
      input.reaction
    );

    return {
      success: true,
    };
  }
}
