import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const WorkspaceDownloadsBreadcrumb = () => {
  return (
    <BreadcrumbItem
      id="downloads"
      avatar={defaultIcons.downloads}
      name="Downloads"
    />
  );
};
