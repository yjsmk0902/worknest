import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalChatNode } from '@worknest/client/types';
import { ChatCreatePopover } from '@worknest/ui/components/chats/chat-create-popover';
import { ChatSidebarItem } from '@worknest/ui/components/chats/chat-sidebar-item';
import { SidebarHeader } from '@worknest/ui/components/layouts/sidebars/sidebar-header';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

export const SidebarChats = () => {
  const workspace = useWorkspace();

  const chatListQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'chat'))
        .orderBy(({ nodes }) => nodes.id, 'asc'),
    [workspace.userId]
  );

  const chats = chatListQuery.data.map((node) => node as LocalChatNode);

  return (
    <div className="flex flex-col group/sidebar h-full px-2">
      <SidebarHeader title="Chats" actions={<ChatCreatePopover />} />
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        {chats.map((chat) => (
          <ChatSidebarItem key={chat.id} chat={chat} />
        ))}
      </div>
    </div>
  );
};
