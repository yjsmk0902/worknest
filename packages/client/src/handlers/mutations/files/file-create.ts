import { WorkspaceMutationHandlerBase } from '@worknest/client/handlers/mutations/workspace-mutation-handler-base';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  FileCreateMutationInput,
  FileCreateMutationOutput,
} from '@worknest/client/mutations';
import { generateId, IdType } from '@worknest/core';

export class FileCreateMutationHandler
  extends WorkspaceMutationHandlerBase
  implements MutationHandler<FileCreateMutationInput>
{
  async handleMutation(
    input: FileCreateMutationInput
  ): Promise<FileCreateMutationOutput> {
    const workspace = this.getWorkspace(input.userId);

    const fileId = generateId(IdType.File);
    await workspace.files.createFile(fileId, input.tempFileId, input.parentId);

    return {
      id: fileId,
    };
  }
}
