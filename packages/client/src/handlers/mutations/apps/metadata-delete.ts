import { eventBus } from '@worknest/client/lib/event-bus';
import { mapMetadata } from '@worknest/client/lib/mappers';
import { MutationHandler } from '@worknest/client/lib/types';
import {
  MetadataDeleteMutationInput,
  MetadataDeleteMutationOutput,
} from '@worknest/client/mutations/apps/metadata-delete';
import { AppService } from '@worknest/client/services/app-service';

export class MetadataDeleteMutationHandler
  implements MutationHandler<MetadataDeleteMutationInput>
{
  private readonly app: AppService;

  constructor(appService: AppService) {
    this.app = appService;
  }

  async handleMutation(
    input: MetadataDeleteMutationInput
  ): Promise<MetadataDeleteMutationOutput> {
    const deletedMetadata = await this.app.database
      .deleteFrom('metadata')
      .where('namespace', '=', input.namespace)
      .where('key', '=', input.key)
      .returningAll()
      .executeTakeFirst();

    if (!deletedMetadata) {
      return {
        success: true,
      };
    }

    eventBus.publish({
      type: 'metadata.deleted',
      metadata: mapMetadata(deletedMetadata),
    });

    return {
      success: true,
    };
  }
}
