import { LocalMessageNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { Message } from '@worknest/ui/components/messages/message';
import { ConversationContext } from '@worknest/ui/contexts/conversation';

interface MessageContainerProps {
  message: LocalMessageNode;
  role: NodeRole;
}

export const MessageContainer = ({ message, role }: MessageContainerProps) => {
  return (
    <ConversationContext.Provider
      value={{
        id: message.id,
        role: role,
        rootId: message.rootId,
        canCreateMessage: true,
        onReply: () => {},
        onLastMessageIdChange: () => {},
        canDeleteMessage: () => false,
      }}
    >
      <Message message={message} />
    </ConversationContext.Provider>
  );
};
