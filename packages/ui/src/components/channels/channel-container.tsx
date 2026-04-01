import { LocalChannelNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { Conversation } from '@worknest/ui/components/messages/conversation';

interface ChannelContainerProps {
  channel: LocalChannelNode;
  role: NodeRole;
}

export const ChannelContainer = ({ channel, role }: ChannelContainerProps) => {
  return (
    <Conversation
      conversationId={channel.id}
      rootId={channel.rootId}
      role={role}
    />
  );
};
