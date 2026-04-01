import { LocalNode, LocalSpaceNode } from '@worknest/client/types';
import { compareString, generateFractionalIndex } from '@worknest/core';

export const sortSpaceChildren = (
  space: LocalSpaceNode,
  children: LocalNode[]
) => {
  const sortedById = children.toSorted((a, b) => compareString(a.id, b.id));
  const indexes: Record<string, string> = {};
  const childrenSettings = space.children ?? {};
  let lastIndex: string | null = null;

  for (const child of sortedById) {
    lastIndex = generateFractionalIndex(lastIndex, null);
    const customIndex = childrenSettings[child.id]?.index;
    indexes[child.id] = customIndex ?? lastIndex;
  }

  return sortedById.toSorted((a, b) => {
    const aIndex = indexes[a.id];
    const bIndex = indexes[b.id];
    return compareString(aIndex, bIndex);
  });
};
