import { FocusPosition } from '@tiptap/core';

import { LocalNode } from '@worknest/client/types';
import { DocumentEditor } from '@worknest/ui/components/documents/document-editor';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useLiveQuery } from '@worknest/ui/hooks/use-live-query';

interface DocumentProps {
  node: LocalNode;
  canEdit: boolean;
  autoFocus?: FocusPosition;
}

export const Document = ({ node, canEdit, autoFocus }: DocumentProps) => {
  const workspace = useWorkspace();

  const documentStateQuery = useLiveQuery({
    type: 'document.state.get',
    documentId: node.id,
    userId: workspace.userId,
  });

  const documentUpdatesQuery = useLiveQuery({
    type: 'document.updates.list',
    documentId: node.id,
    userId: workspace.userId,
  });

  if (documentStateQuery.isPending || documentUpdatesQuery.isPending) {
    return null;
  }

  const state = documentStateQuery.data ?? null;
  const updates = documentUpdatesQuery.data ?? [];

  return (
    <DocumentEditor
      key={node.id}
      node={node}
      state={state}
      updates={updates}
      canEdit={canEdit}
      autoFocus={autoFocus}
    />
  );
};
