import { LocalNode } from '@worknest/client/types';
import { ChannelSidebarItem } from '@worknest/ui/components/channels/channel-sidebar-item';
import { ChatSidebarItem } from '@worknest/ui/components/chats/chat-sidebar-item';
import { DatabaseSidebarItem } from '@worknest/ui/components/databases/database-sidiebar-item';
import { ViewSidebarItem } from '@worknest/ui/components/databases/view-sidebar-item';
import { FolderSidebarItem } from '@worknest/ui/components/folders/folder-sidebar-item';
import { PageSidebarItem } from '@worknest/ui/components/pages/page-sidebar-item';
import { SpaceSidebarItem } from '@worknest/ui/components/spaces/space-sidebar-item';

interface SidebarItemProps {
  node: LocalNode;
}

export const SidebarItem = ({ node }: SidebarItemProps): React.ReactNode => {
  switch (node.type) {
    case 'space':
      return <SpaceSidebarItem space={node} />;
    case 'channel':
      return <ChannelSidebarItem channel={node} />;
    case 'chat':
      return <ChatSidebarItem chat={node} />;
    case 'page':
      return <PageSidebarItem page={node} />;
    case 'database':
      return <DatabaseSidebarItem database={node} />;
    case 'database_view':
      return <ViewSidebarItem view={node} />;
    case 'folder':
      return <FolderSidebarItem folder={node} />;
    default:
      return null;
  }
};
