import { createRoute, redirect } from '@tanstack/react-router';

import { WorkspaceUploadsContainer } from '@worknest/ui/components/workspaces/uploads/workspace-uploads-container';
import { WorkspaceUploadsTab } from '@worknest/ui/components/workspaces/uploads/workspace-uploads-tab';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@worknest/ui/routes/workspace';

export const workspaceUploadsRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/uploads',
  component: WorkspaceUploadsContainer,
  context: () => {
    return {
      tab: <WorkspaceUploadsTab />,
    };
  },
});

export const workspaceUploadsMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/uploads',
  component: () => null,
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/uploads',
        params: { userId },
        replace: true,
      });
    }
  },
});
