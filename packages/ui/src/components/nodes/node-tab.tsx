import { eq, useLiveQuery } from '@tanstack/react-db';

import { collections } from '@worknest/ui/collections';
import { ChannelTab } from '@worknest/ui/components/channels/channel-tab';
import { ChatTab } from '@worknest/ui/components/chats/chat-tab';
import { DatabaseTab } from '@worknest/ui/components/databases/database-tab';
import { FileTab } from '@worknest/ui/components/files/file-tab';
import { FolderTab } from '@worknest/ui/components/folders/folder-tab';
import { MessageTab } from '@worknest/ui/components/messages/message-tab';
import { PageTab } from '@worknest/ui/components/pages/page-tab';
import { RecordTab } from '@worknest/ui/components/records/record-tab';
import { SpaceTab } from '@worknest/ui/components/spaces/space-tab';

interface NodeTabProps {
  userId: string;
  nodeId: string;
}

export const NodeTab = ({ userId, nodeId }: NodeTabProps) => {
  const query = useLiveQuery(
    (q) =>
      q
        .from({ nodes: collections.workspace(userId).nodes })
        .where(({ nodes }) => eq(nodes.id, nodeId))
        .findOne(),
    [userId, nodeId]
  );

  if (query.isLoading) {
    return null;
  }

  const node = query.data;
  if (!node) {
    return null;
  }

  switch (node.type) {
    case 'space':
      return <SpaceTab space={node} />;
    case 'channel':
      return <ChannelTab channel={node} />;
    case 'chat':
      return <ChatTab userId={userId} chat={node} />;
    case 'page':
      return <PageTab page={node} />;
    case 'database':
      return <DatabaseTab database={node} />;
    case 'record':
      return <RecordTab record={node} />;
    case 'folder':
      return <FolderTab folder={node} />;
    case 'file':
      return <FileTab userId={userId} file={node} />;
    case 'message':
      return <MessageTab message={node} />;
    default:
      return null;
  }
};
