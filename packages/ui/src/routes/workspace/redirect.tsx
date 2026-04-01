import { createRoute, notFound, redirect } from '@tanstack/react-router';

import { collections } from '@worknest/ui/collections';
import { buildMetadataKey } from '@worknest/ui/collections/metadata';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceMaskRoute,
  workspaceRoute,
} from '@worknest/ui/routes/workspace';

export const workspaceRedirectRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/',
  component: () => null,
  beforeLoad: (ctx) => {
    const workspace = collections.workspaces.get(ctx.params.userId);

    if (!workspace) {
      throw notFound({ throw: true });
    }

    const metadataKey = buildMetadataKey(workspace.userId, 'location');
    const metadataValue = collections.metadata.get(metadataKey)?.value;
    const lastLocation = metadataValue ? JSON.parse(metadataValue) : undefined;

    if (lastLocation) {
      throw redirect({ to: lastLocation, replace: true });
    }

    throw redirect({
      from: '/workspace/$userId',
      to: 'home',
      replace: true,
    });
  },
});

export const workspaceRedirectMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/',
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
