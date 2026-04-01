import { LocalChannelNode } from '@worknest/client/types';
import { NodeRole, hasNodeRole } from '@worknest/core';
import {
  ChannelForm,
  ChannelFormValues,
} from '@worknest/ui/components/channels/channel-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@worknest/ui/components/ui/dialog';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

interface ChannelUpdateDialogProps {
  channel: LocalChannelNode;
  role: NodeRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChannelUpdateDialog = ({
  channel,
  role,
  open,
  onOpenChange,
}: ChannelUpdateDialogProps) => {
  const workspace = useWorkspace();
  const canEdit = hasNodeRole(role, 'editor');

  const handleSubmit = (values: ChannelFormValues) => {
    const nodes = workspace.collections.nodes;
    if (!nodes.has(channel.id)) {
      return;
    }

    nodes.update(channel.id, (draft) => {
      if (draft.type !== 'channel') {
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
          <DialogTitle>Update channel</DialogTitle>
          <DialogDescription>
            Update the channel name and icon
          </DialogDescription>
        </DialogHeader>
        <ChannelForm
          id={channel.id}
          values={{
            name: channel.name,
            avatar: channel.avatar,
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
