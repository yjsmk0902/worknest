import { LocalFolderNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { FolderBody } from '@worknest/ui/components/folders/folder-body';

interface FolderContainerProps {
  folder: LocalFolderNode;
  role: NodeRole;
}

export const FolderContainer = ({ folder, role }: FolderContainerProps) => {
  return <FolderBody folder={folder} role={role} />;
};
