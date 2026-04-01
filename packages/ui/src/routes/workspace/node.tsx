import { createRoute, redirect } from '@tanstack/react-router';

import { NodeContainer } from '@worknest/ui/components/nodes/node-container';
import { NodeErrorContainer } from '@worknest/ui/components/nodes/node-error-container';
import { NodeTab } from '@worknest/ui/components/nodes/node-tab';
import { getWorkspaceUserId } from '@worknest/ui/routes/utils';
import {
  workspaceRoute,
  workspaceMaskRoute,
} from '@worknest/ui/routes/workspace';

export const nodeRoute = createRoute({
  getParentRoute: () => workspaceRoute,
  path: '/$nodeId',
  component: () => {
    const { nodeId } = nodeRoute.useParams();
    return <NodeContainer type="full" nodeId={nodeId} />;
  },
  errorComponent: NodeErrorContainer,
  context: (ctx) => {
    return {
      tab: <NodeTab userId={ctx.params.userId} nodeId={ctx.params.nodeId} />,
    };
  },
});

export const nodeMaskRoute = createRoute({
  getParentRoute: () => workspaceMaskRoute,
  path: '/$nodeId',
  beforeLoad: (ctx) => {
    const userId = getWorkspaceUserId(ctx.params.workspaceId);
    if (userId) {
      throw redirect({
        to: '/workspace/$userId/$nodeId',
        params: {
          userId,
          nodeId: ctx.params.nodeId,
        },
        replace: true,
      });
    }
  },
});
