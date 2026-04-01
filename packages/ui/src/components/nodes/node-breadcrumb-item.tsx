import { LocalNode } from '@worknest/client/types';
import { ChannelBreadcrumbItem } from '@worknest/ui/components/channels/channel-breadcrumb-item';
import { ChatBreadcrumbItem } from '@worknest/ui/components/chats/chat-breadcrumb-item';
import { DatabaseBreadcrumbItem } from '@worknest/ui/components/databases/database-breadcrumb-item';
import { FileBreadcrumbItem } from '@worknest/ui/components/files/file-breadcrumb-item';
import { FolderBreadcrumbItem } from '@worknest/ui/components/folders/folder-breadcrumb-item';
import { MessageBreadcrumbItem } from '@worknest/ui/components/messages/message-breadcrumb-item';
import { PageBreadcrumbItem } from '@worknest/ui/components/pages/page-breadcrumb-item';
import { RecordBreadcrumbItem } from '@worknest/ui/components/records/record-breadcrumb-item';
import { SpaceBreadcrumbItem } from '@worknest/ui/components/spaces/space-breadcrumb-item';

interface NodeBreadcrumbItemProps {
  node: LocalNode;
}

export const NodeBreadcrumbItem = ({ node }: NodeBreadcrumbItemProps) => {
  switch (node.type) {
    case 'space':
      return <SpaceBreadcrumbItem space={node} />;
    case 'channel':
      return <ChannelBreadcrumbItem channel={node} />;
    case 'chat':
      return <ChatBreadcrumbItem chat={node} />;
    case 'page':
      return <PageBreadcrumbItem page={node} />;
    case 'database':
      return <DatabaseBreadcrumbItem database={node} />;
    case 'record':
      return <RecordBreadcrumbItem record={node} />;
    case 'folder':
      return <FolderBreadcrumbItem folder={node} />;
    case 'file':
      return <FileBreadcrumbItem file={node} />;
    case 'message':
      return <MessageBreadcrumbItem message={node} />;
    default:
      return null;
  }
};
