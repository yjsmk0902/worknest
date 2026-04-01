import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { ServerListQueryInput } from '@worknest/client/queries/servers/server-list';
import { AppService } from '@worknest/client/services/app-service';
import { Server } from '@worknest/client/types';
import { Event } from '@worknest/client/types/events';

export class ServerListQueryHandler
  implements QueryHandler<ServerListQueryInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(_: ServerListQueryInput): Promise<Server[]> {
    return this.getServers();
  }

  public async checkForChanges(
    event: Event
  ): Promise<ChangeCheckResult<ServerListQueryInput>> {
    if (event.type === 'server.created') {
      const newServers = this.getServers();
      return {
        hasChanges: true,
        result: newServers,
      };
    }

    if (event.type === 'server.updated') {
      const newServers = this.getServers();
      return {
        hasChanges: true,
        result: newServers,
      };
    }

    if (event.type === 'server.deleted') {
      const newServers = this.getServers();
      return {
        hasChanges: true,
        result: newServers,
      };
    }

    return {
      hasChanges: false,
    };
  }

  private getServers(): Server[] {
    return this.app.getServers().map((server) => server.server);
  }
}
