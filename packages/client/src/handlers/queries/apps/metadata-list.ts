import { SelectMetadata } from '@worknest/client/databases/app/schema';
import { mapMetadata } from '@worknest/client/lib/mappers';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { MetadataListQueryInput } from '@worknest/client/queries/apps/metadata-list';
import { AppService } from '@worknest/client/services/app-service';
import { Metadata } from '@worknest/client/types/apps';
import { Event } from '@worknest/client/types/events';

export class MetadataListQueryHandler
  implements QueryHandler<MetadataListQueryInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(_: MetadataListQueryInput): Promise<Metadata[]> {
    const rows = await this.getAppMetadata();
    if (!rows) {
      return [];
    }

    return rows.map(mapMetadata);
  }

  public async checkForChanges(
    event: Event,
    _: MetadataListQueryInput,
    output: Metadata[]
  ): Promise<ChangeCheckResult<MetadataListQueryInput>> {
    if (event.type === 'metadata.updated') {
      const newOutput = [
        ...output.filter((metadata) => metadata.key !== event.metadata.key),
        event.metadata,
      ];

      return {
        hasChanges: true,
        result: newOutput,
      };
    }

    if (event.type === 'metadata.deleted') {
      const newOutput = output.filter(
        (metadata) => metadata.key !== event.metadata.key
      );

      return {
        hasChanges: true,
        result: newOutput,
      };
    }

    return {
      hasChanges: false,
    };
  }

  private async getAppMetadata(): Promise<SelectMetadata[] | undefined> {
    const rows = await this.app.database
      .selectFrom('metadata')
      .selectAll()
      .execute();

    return rows;
  }
}
