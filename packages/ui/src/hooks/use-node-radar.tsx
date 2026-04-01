import { useEffect } from 'react';

import { Node } from '@worknest/core';
import { useRadar } from '@worknest/ui/contexts/radar';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

export const useNodeRadar = (node: Node | null | undefined) => {
  const workspace = useWorkspace();
  const radar = useRadar();

  useEffect(() => {
    if (!node) {
      return;
    }

    radar.markNodeAsOpened(workspace.userId, node.id);

    const interval = setInterval(() => {
      radar.markNodeAsOpened(workspace.userId, node.id);
    }, 60000);

    return () => clearInterval(interval);
  }, [node?.id]);
};
