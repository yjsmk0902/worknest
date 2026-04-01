import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  NodeCreateMutationInput,
  NodeCreateMutationOutput,
} from '@worknest/client/mutations/nodes/node-create';

export class NodeCreateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<NodeCreateMutationInput>
{
  async handleMutation(
    input: NodeCreateMutationInput
  ): Promise<NodeCreateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);
    await workspace.nodes.insertNode(input.nodeId, input.attributes);

    return {
      success: true,
    };
  }
}
