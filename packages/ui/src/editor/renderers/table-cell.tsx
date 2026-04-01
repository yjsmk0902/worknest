import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@worknest/ui/editor/classes';
import { NodeChildrenRenderer } from '@worknest/ui/editor/renderers/node-children';
import { editorColors } from '@worknest/ui/lib/editor';
import { cn } from '@worknest/ui/lib/utils';

interface TableCellRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const TableCellRenderer = ({
  node,
  keyPrefix,
}: TableCellRendererProps) => {
  const align = node.attrs?.align ?? 'left';
  const backgroundColorAttr = node.attrs?.backgroundColor ?? null;
  const backgroundColor = backgroundColorAttr
    ? editorColors.find((color) => color.color === backgroundColorAttr)
    : null;

  return (
    <td className={defaultClasses.tableCellWrapper}>
      <div
        className={cn(
          defaultClasses.tableCell,
          backgroundColor?.bgClass,
          align === 'left' && 'justify-start',
          align === 'center' && 'justify-center',
          align === 'right' && 'justify-end'
        )}
      >
        <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
      </div>
    </td>
  );
};
