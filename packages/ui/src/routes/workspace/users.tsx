import { createRoute, redirect } from '@tanstack/react-router';

import { WorkspaceUsersContainer } from '@worknest/ui/components/workspaces/workspace-users-container';
import { WorkspaceUsersTab } from '@worknest/ui/components/workspaces/workspace-users-tab';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@worknest/ui/routes/workspace';

export const workspaceUsersRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/users',
  component: WorkspaceUsersContainer,
  context: () => {
    return {
      tab: <WorkspaceUsersTab />,
    };
  },
});

export const workspaceUsersMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/users',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/users',
        params: { userId },
        replace: true,
      });
    }
  },
});
