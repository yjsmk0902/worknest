import { mapBlocksToContents } from '@worknest/client/lib';
import { LocalMessageNode } from '@worknest/client/types';
import { NodeRenderer } from '@worknest/ui/editor/renderers/node';

interface MessageContentProps {
  message: LocalMessageNode;
}

export const MessageContent = ({ message }: MessageContentProps) => {
  const nodeBlocks = Object.values(message.content ?? {});
  const contents = mapBlocksToContents(message.id, nodeBlocks);

  return (
    <div className="text-foreground">
      {contents.map((node) => (
        <NodeRenderer
          key={node.attrs?.id}
          node={node}
          keyPrefix={node.attrs?.id}
        />
      ))}
    </div>
  );
};
