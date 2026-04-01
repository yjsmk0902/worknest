import { createRoute } from '@tanstack/react-router';

import { NodeErrorContainer } from '@worknest/ui/components/nodes/node-error-container';
import { NodeModal } from '@worknest/ui/components/nodes/node-modal';
import { NodeTab } from '@worknest/ui/components/nodes/node-tab';
import { nodeRoute } from '@worknest/ui/routes/workspace/node';

export const modalNodeRoute = createRoute({
  getParentRoute: () => nodeRoute,
  path: '/modal/$modalNodeId',
  component: () => {
    const { modalNodeId } = modalNodeRoute.useParams();
    return <NodeModal nodeId={modalNodeId} />;
  },
  errorComponent: NodeErrorContainer,
  context: (ctx) => {
    return {
      tab: <NodeTab userId={ctx.params.userId} nodeId={ctx.params.nodeId} />,
    };
  },
});
