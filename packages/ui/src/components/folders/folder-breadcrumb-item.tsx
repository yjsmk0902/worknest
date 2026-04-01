import { LocalFolderNode } from '@worknest/client/types';
import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';

interface FolderBreadcrumbItemProps {
  folder: LocalFolderNode;
}

export const FolderBreadcrumbItem = ({ folder }: FolderBreadcrumbItemProps) => {
  return (
    <BreadcrumbItem id={folder.id} avatar={folder.avatar} name={folder.name} />
  );
};
