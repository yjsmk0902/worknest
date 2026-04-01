import { JSONContent } from '@tiptap/core';

import { defaultClasses } from '@worknest/ui/editor/classes';
import { NodeChildrenRenderer } from '@worknest/ui/editor/renderers/node-children';
import { editorColors } from '@worknest/ui/lib/editor';
import { cn } from '@worknest/ui/lib/utils';

interface TableHeaderRendererProps {
  node: JSONContent;
  keyPrefix: string | null;
}

export const TableHeaderRenderer = ({
  node,
  keyPrefix,
}: TableHeaderRendererProps) => {
  const align = node.attrs?.align ?? 'left';
  const backgroundColorAttr = node.attrs?.backgroundColor ?? null;
  const backgroundColor = backgroundColorAttr
    ? editorColors.find((color) => color.color === backgroundColorAttr)
    : null;

  return (
    <th className={defaultClasses.tableHeaderWrapper}>
      <div
        className={cn(
          defaultClasses.tableHeader,
          backgroundColor?.bgClass,
          align === 'left' && 'justify-start',
          align === 'center' && 'justify-center',
          align === 'right' && 'justify-end'
        )}
      >
        <NodeChildrenRenderer node={node} keyPrefix={keyPrefix} />
      </div>
    </th>
  );
};
