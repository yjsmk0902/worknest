import { Avatar } from '@worknest/ui/components/avatars/avatar';
import { AvatarPopover } from '@worknest/ui/components/avatars/avatar-popover';
import { Button } from '@worknest/ui/components/ui/button';
import { useRecord } from '@worknest/ui/contexts/record';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

export const RecordAvatar = () => {
  const workspace = useWorkspace();
  const record = useRecord();

  if (!record.canEdit) {
    return (
      <Button type="button" variant="outline" size="icon">
        <Avatar
          id={record.id}
          name={record.name}
          avatar={record.avatar}
          className="h-6 w-6"
        />
      </Button>
    );
  }

  return (
    <AvatarPopover
      onPick={(avatar) => {
        if (avatar === record.avatar) return;

        const nodes = workspace.collections.nodes;
        nodes.update(record.id, (draft) => {
          if (draft.type !== 'record') {
            return;
          }
          draft.avatar = avatar;
        });
      }}
    >
      <Button type="button" variant="outline" size="icon">
        <Avatar
          id={record.id}
          name={record.name}
          avatar={record.avatar}
          className="size-6"
        />
      </Button>
    </AvatarPopover>
  );
};
