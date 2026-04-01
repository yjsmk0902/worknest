import { LocalChatNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { Conversation } from '@worknest/ui/components/messages/conversation';

interface ChatContainerProps {
  node: LocalChatNode;
  role: NodeRole;
}

export const ChatContainer = ({ node, role }: ChatContainerProps) => {
  return (
    <Conversation conversationId={node.id} rootId={node.rootId} role={role} />
  );
};
