import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@worknest/ui/editor/classes';
import { NodeChildrenRenderer } from '@worknest/ui/editor/renderers/node-children';
import { cn } from '@worknest/ui/lib/utils';

interface TableRowRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const TableRowRenderer = ({
  node,
  keyPrefix,
}: TableRowRendererProps) => {
  return (
    <tr className={cn(defaultClasses.tableRow)}>
      <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
    </tr>
  );
};
