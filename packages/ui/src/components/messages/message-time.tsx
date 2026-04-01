import { LocalMessageNode } from '@worknest/client/types';
import { formatDate, timeAgo } from '@worknest/core';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@worknest/ui/components/ui/tooltip';

interface MessageTimeProps {
  message: LocalMessageNode;
}

export const MessageTime = ({ message }: MessageTimeProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-2 text-xs text-muted-foreground">
          {timeAgo(message.createdAt)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-sm shadow-md">
          {formatDate(message.createdAt)}
        </span>
      </TooltipContent>
    </Tooltip>
  );
};
