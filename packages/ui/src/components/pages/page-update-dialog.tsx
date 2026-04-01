import { LocalPageNode } from '@worknest/client/types';
import { NodeRole, hasNodeRole } from '@worknest/core';
import {
  PageForm,
  PageFormValues,
} from '@worknest/ui/components/pages/page-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@worknest/ui/components/ui/dialog';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

interface PageUpdateDialogProps {
  page: LocalPageNode;
  role: NodeRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PageUpdateDialog = ({
  page,
  role,
  open,
  onOpenChange,
}: PageUpdateDialogProps) => {
  const workspace = useWorkspace();
  const canEdit = hasNodeRole(role, 'editor');

  const handleSubmit = (values: PageFormValues) => {
    const nodes = workspace.collections.nodes;
    if (!nodes.has(page.id)) {
      return;
    }

    nodes.update(page.id, (draft) => {
      if (draft.type !== 'page') {
        return;
      }

      draft.name = values.name;
      draft.avatar = values.avatar;
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update page</DialogTitle>
          <DialogDescription>Update the page name and icon</DialogDescription>
        </DialogHeader>
        <PageForm
          id={page.id}
          values={{
            name: page.name,
            avatar: page.avatar,
          }}
          submitText="Update"
          readOnly={!canEdit}
          onCancel={() => {
            onOpenChange(false);
          }}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
};
