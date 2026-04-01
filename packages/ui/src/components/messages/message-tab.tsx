import { MessageCircle } from 'lucide-react';

import { LocalMessageNode } from '@worknest/client/types';

interface MessageTabProps {
  message: LocalMessageNode;
}

export const MessageTab = ({ message }: MessageTabProps) => {
  return (
    <div className="flex items-center space-x-2" id={message.id}>
      <MessageCircle className="size-4" />
      <span>Message</span>
    </div>
  );
};
