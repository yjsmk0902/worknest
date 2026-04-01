import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  NodeUpdateMutationInput,
  NodeUpdateMutationOutput,
} from '@worknest/client/mutations/nodes/node-update';

export class NodeUpdateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<NodeUpdateMutationInput>
{
  async handleMutation(
    input: NodeUpdateMutationInput
  ): Promise<NodeUpdateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);
    await workspace.nodes.updateNode(input.nodeId, () => {
      return input.attributes;
    });

    return {
      success: true,
    };
  }
}
