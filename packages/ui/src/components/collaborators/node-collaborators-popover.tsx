import { UserRoundPlus } from 'lucide-react';

import { Node, NodeRole } from '@worknest/core';
import { NodeCollaborators } from '@worknest/ui/components/collaborators/node-collaborators';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@worknest/ui/components/ui/popover';

interface NodeCollaboratorsPopoverProps {
  node: Node;
  nodes: Node[];
  role: NodeRole;
}

export const NodeCollaboratorsPopover = ({
  node,
  nodes,
  role,
}: NodeCollaboratorsPopoverProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <UserRoundPlus className="size-5 cursor-pointer text-muted-foreground hover:text-foreground" />
      </PopoverTrigger>
      <PopoverContent className="mr-2 max-h-128 w-lg overflow-auto">
        <NodeCollaborators node={node} nodes={nodes} role={role} />
      </PopoverContent>
    </Popover>
  );
};
