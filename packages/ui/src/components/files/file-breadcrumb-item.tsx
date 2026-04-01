import { LocalFileNode } from '@worknest/client/types';
import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

interface FileBreadcrumbItemProps {
  file: LocalFileNode;
}

export const FileBreadcrumbItem = ({ file }: FileBreadcrumbItemProps) => {
  return (
    <BreadcrumbItem id={file.id} avatar={defaultIcons.file} name={file.name} />
  );
};
