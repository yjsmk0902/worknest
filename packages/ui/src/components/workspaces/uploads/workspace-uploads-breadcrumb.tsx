import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const WorkspaceUploadsBreadcrumb = () => {
  return (
    <BreadcrumbItem id="uploads" avatar={defaultIcons.uploads} name="Uploads" />
  );
};
