import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalMessageNode } from '@worknest/client/types';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { cn } from '@worknest/ui/lib/utils';

interface MessageAuthorNameProps {
  message: LocalMessageNode;
  className?: string;
}

export const MessageAuthorName = ({
  message,
  className,
}: MessageAuthorNameProps) => {
  const workspace = useWorkspace();

  const userQuery = useLiveQuery(
    (q) =>
      q
        .from({ users: workspace.collections.users })
        .where(({ users }) => eq(users.id, message.createdBy))
        .select(({ users }) => ({
          name: users.name,
        }))
        .findOne(),
    [workspace.userId, message.createdBy]
  );

  const user = userQuery.data;
  if (!user) {
    return null;
  }

  return (
    <span className={cn('font-medium text-foreground', className)}>
      {user.name}
    </span>
  );
};
