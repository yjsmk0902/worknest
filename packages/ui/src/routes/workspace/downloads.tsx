import { createRoute, redirect } from '@tanstack/react-router';

import { WorkspaceDownloadsContainer } from '@worknest/ui/components/workspaces/downloads/workspace-downloads-container';
import { WorkspaceDownloadsTab } from '@worknest/ui/components/workspaces/downloads/workspace-downloads-tab';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@worknest/ui/routes/workspace';

export const workspaceDownloadsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/downloads',
  component: WorkspaceDownloadsContainer,
  context: () => {
    return {
      tab: <WorkspaceDownloadsTab />,
    };
  },
});

export const workspaceDownloadsMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/downloads',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/downloads',
        params: { userId },
        replace: true,
      });
    }
  },
});
