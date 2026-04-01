import { debounceStrategy, usePacedMutations } from '@tanstack/react-db';

import { LocalNode } from '@worknest/client/types';
import { FieldAttributes } from '@worknest/core';
import { Input } from '@worknest/ui/components/ui/input';
import { useDatabase } from '@worknest/ui/contexts/database';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { applyNodeTransaction } from '@worknest/ui/lib/nodes';

interface FieldRenameInputProps {
  field: FieldAttributes;
}

export const FieldRenameInput = ({ field }: FieldRenameInputProps) => {
  const workspace = useWorkspace();
  const database = useDatabase();

  const mutate = usePacedMutations<string, LocalNode>({
    onMutate: (value) => {
      workspace.collections.nodes.update(database.id, (draft) => {
        if (draft.type !== 'database') {
          return;
        }

        const fieldAttributes = draft.fields[field.id];
        if (!fieldAttributes) {
          return;
        }

        fieldAttributes.name = value;
      });
    },
    mutationFn: async ({ transaction }) => {
      await applyNodeTransaction(workspace.userId, transaction);
    },
    strategy: debounceStrategy({ wait: 500 }),
  });

  return (
    <div className="w-full p-1">
      <Input
        value={field.name}
        readOnly={!database.canEdit || database.isLocked}
        onChange={(event) => {
          const newValue = event.target.value;
          mutate(newValue);
        }}
      />
    </div>
  );
};
