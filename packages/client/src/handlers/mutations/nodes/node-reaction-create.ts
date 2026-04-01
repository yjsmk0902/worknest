import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  NodeReactionCreateMutationInput,
  NodeReactionCreateMutationOutput,
} from '@worknest/client/mutations/nodes/node-reaction-create';

export class NodeReactionCreateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<NodeReactionCreateMutationInput>
{
  async handleMutation(
    input: NodeReactionCreateMutationInput
  ): Promise<NodeReactionCreateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);
    await workspace.nodeReactions.createNodeReaction(
      input.nodeId,
      input.reaction
    );

    return {
      success: true,
    };
  }
}
