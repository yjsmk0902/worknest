import { QueryError, QueryErrorCode } from '@worknest/client/queries';
import { AppService } from '@worknest/client/services/app-service';
import { WorkspaceService } from '@worknest/client/services/workspaces/workspace-service';

export abstract class WorkspaceQueryHandlerBase {
  protected readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  protected getWorkspace(userId: string): WorkspaceService {
    const workspace = this.app.getWorkspace(userId);
    if (!workspace) {
      throw new QueryError(
        QueryErrorCode.WorkspaceNotFound,
        'Workspace not found or has been deleted.'
      );
    }

    return workspace;
  }
}
