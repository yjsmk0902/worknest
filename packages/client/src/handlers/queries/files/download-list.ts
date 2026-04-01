import { WorkspaceQueryHandlerBase } from '@worknest/client/handlers/queries/workspace-query-handler-base';
import { mapDownload } from '@worknest/client/lib';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { DownloadListQueryInput } from '@worknest/client/queries/files/download-list';
import { Event } from '@worknest/client/types/events';
import { Download } from '@worknest/client/types/files';

export class DownloadListQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<DownloadListQueryInput>
{
  public async handleQuery(input: DownloadListQueryInput): Promise<Download[]> {
    return await this.fetchDownloads(input);
  }

  public async checkForChanges(
    event: Event,
    input: DownloadListQueryInput,
    output: Download[]
  ): Promise<ChangeCheckResult<DownloadListQueryInput>> {
    if (
      event.type === 'workspace.deleted' &&
      event.workspace.userId === input.userId
    ) {
      return {
        hasChanges: true,
        result: [],
      };
    }

    if (
      event.type === 'download.created' &&
      event.workspace.userId === input.userId
    ) {
      const newResult = [...output, event.download];
      return {
        hasChanges: true,
        result: newResult,
      };
    }

    if (
      event.type === 'download.updated' &&
      event.workspace.userId === input.userId
    ) {
      const download = output.find(
        (download) => download.id === event.download.id
      );

      if (download) {
        const newResult = output.map((download) => {
          if (download.id === event.download.id) {
            return event.download;
          }

          return download;
        });

        return {
          hasChanges: true,
          result: newResult,
        };
      }
    }

    if (
      event.type === 'download.deleted' &&
      event.workspace.userId === input.userId
    ) {
      const download = output.find(
        (download) => download.id === event.download.id
      );

      if (download) {
        const newResult = output.filter(
          (download) => download.id !== event.download.id
        );

        return {
          hasChanges: true,
          result: newResult,
        };
      }
    }

    return {
      hasChanges: false,
    };
  }

  private async fetchDownloads(
    input: DownloadListQueryInput
  ): Promise<Download[]> {
    const workspace = this.getWorkspace(input.userId);

    const downloads = await workspace.database
      .selectFrom('downloads')
      .selectAll()
      .execute();

    return downloads.map(mapDownload);
  }
}
