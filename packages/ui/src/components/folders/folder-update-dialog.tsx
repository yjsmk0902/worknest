import { LocalFolderNode } from '@worknest/client/types';
import { NodeRole, hasNodeRole } from '@worknest/core';
import {
  FolderForm,
  FolderFormValues,
} from '@worknest/ui/components/folders/folder-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@worknest/ui/components/ui/dialog';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

interface FolderUpdateDialogProps {
  folder: LocalFolderNode;
  role: NodeRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FolderUpdateDialog = ({
  folder,
  role,
  open,
  onOpenChange,
}: FolderUpdateDialogProps) => {
  const workspace = useWorkspace();
  const canEdit = hasNodeRole(role, 'editor');

  const handleSubmit = (values: FolderFormValues) => {
    const nodes = workspace.collections.nodes;
    if (!nodes.has(folder.id)) {
      return;
    }

    nodes.update(folder.id, (draft) => {
      if (draft.type !== 'folder') {
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
          <DialogTitle>Update folder</DialogTitle>
          <DialogDescription>Update the folder name and icon</DialogDescription>
        </DialogHeader>
        <FolderForm
          id={folder.id}
          values={{
            name: folder.name,
            avatar: folder.avatar,
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
