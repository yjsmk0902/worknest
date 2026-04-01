import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  DocumentUpdateMutationInput,
  DocumentUpdateMutationOutput,
} from '@worknest/client/mutations';
import { decodeState } from '@worknest/crdt';

export class DocumentUpdateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<DocumentUpdateMutationInput>
{
  async handleMutation(
    input: DocumentUpdateMutationInput
  ): Promise<DocumentUpdateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);
    await workspace.documents.updateDocument(
      input.documentId,
      decodeState(input.update)
    );

    return {
      success: true,
    };
  }
}
