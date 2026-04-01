import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const WorkspaceHomeBreadcrumb = () => {
  return <BreadcrumbItem id="home" avatar={defaultIcons.home} name="Home" />;
};
