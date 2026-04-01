import { LocalPageNode } from '@worknest/client/types';
import { NodeRole, hasNodeRole } from '@worknest/core';
import { Document } from '@worknest/ui/components/documents/document';

interface PageContainerProps {
  page: LocalPageNode;
  role: NodeRole;
}

export const PageContainer = ({ page, role }: PageContainerProps) => {
  const canEdit = hasNodeRole(role, 'editor');
  return <Document node={page} canEdit={canEdit} autoFocus="start" />;
};
