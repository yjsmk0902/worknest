import { debounceStrategy, usePacedMutations } from '@tanstack/react-db';

import { LocalNode } from '@worknest/client/types';
import { DatabaseViewLayout } from '@worknest/core';
import { AvatarPopover } from '@worknest/ui/components/avatars/avatar-popover';
import { ViewIcon } from '@worknest/ui/components/databases/view-icon';
import { Button } from '@worknest/ui/components/ui/button';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { applyNodeTransaction } from '@worknest/ui/lib/nodes';

interface ViewAvatarInputProps {
  id: string;
  name: string;
  avatar?: string | null;
  layout: DatabaseViewLayout;
  readOnly?: boolean;
}

export const ViewAvatarInput = ({
  id,
  name,
  avatar,
  layout,
  readOnly,
}: ViewAvatarInputProps) => {
  const workspace = useWorkspace();

  const mutate = usePacedMutations<string, LocalNode>({
    onMutate: (value) => {
      workspace.collections.nodes.update(id, (draft) => {
        if (draft.type !== 'database_view') {
          return;
        }

        draft.avatar = value;
      });
    },
    mutationFn: async ({ transaction }) => {
      await applyNodeTransaction(workspace.userId, transaction);
    },
    strategy: debounceStrategy({ wait: 500 }),
  });

  if (readOnly) {
    return (
      <Button type="button" variant="outline" size="icon">
        <ViewIcon
          id={id}
          name={name}
          avatar={avatar}
          layout={layout}
          className="size-4"
        />
      </Button>
    );
  }

  return (
    <AvatarPopover
      onPick={(value) => {
        mutate(value);
      }}
    >
      <Button type="button" variant="outline" size="icon">
        <ViewIcon
          id={id}
          name={name}
          avatar={avatar}
          layout={layout}
          className="size-4"
        />
      </Button>
    </AvatarPopover>
  );
};
