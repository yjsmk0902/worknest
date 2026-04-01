import { createRoute, redirect } from '@tanstack/react-router';

import { WorkspaceHomeContainer } from '@worknest/ui/components/workspaces/workspace-home-container';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceMaskRoute,
  workspaceRoute,
} from '@worknest/ui/routes/workspace';

export const workspaceHomeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/home',
  component: WorkspaceHomeContainer,
});

export const workspaceHomeMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/home',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/home',
        params: { userId },
        replace: true,
      });
    }
  },
});
