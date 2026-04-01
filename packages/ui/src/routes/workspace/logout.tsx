import { createRoute, redirect } from '@tanstack/react-router';

import { LogoutContainer } from '@worknest/ui/components/auth/logout-container';
import { LogoutTab } from '@worknest/ui/components/auth/logout-tab';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@worknest/ui/routes/workspace';

export const logoutRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/logout',
  component: LogoutContainer,
  context: () => {
    return {
      tab: <LogoutTab />,
    };
  },
});

export const logoutMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/logout',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/logout',
        params: { userId },
        replace: true,
      });
    }
  },
});
