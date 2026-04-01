import { LocalChatNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { NodeCollaboratorsPopover } from '@worknest/ui/components/collaborators/node-collaborators-popover';

interface ChatSettingsProps {
  chat: LocalChatNode;
  role: NodeRole;
}
export const ChatSettings = ({ chat, role }: ChatSettingsProps) => {
  return <NodeCollaboratorsPopover node={chat} nodes={[chat]} role={role} />;
};
