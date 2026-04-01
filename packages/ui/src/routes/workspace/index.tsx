import { createRoute, notFound } from '@tanstack/react-router';

import { collections } from '@worknest/ui/collections';
import { Workspace } from '@worknest/ui/components/workspaces/workspace';
import { WorkspaceNotFound } from '@worknest/ui/components/workspaces/workspace-not-found';
import { WorkspaceTab } from '@worknest/ui/components/workspaces/workspace-tab';
import { rootRoute } from '@worknest/ui/routes/root';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';

export const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/workspace/$userId',
  component: () => {
    const { userId } = workspaceRoute.useParams();
    return <Workspace userId={userId} />;
  },
  notFoundComponent: WorkspaceNotFound,
  context: (ctx) => {
    return {
      tab: <WorkspaceTab userId={ctx.params.userId} />,
    };
  },
  loader: (ctx) => {
    const workspace = collections.workspaces.get(ctx.params.userId);
    if (!workspace) {
      throw notFound();
    }
  },
});

export const workspaceMaskRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$workspaceId',
  notFoundComponent: WorkspaceNotFound,
  loader: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (!userId) {
      throw notFound();
    }
  },
});
