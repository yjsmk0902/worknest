import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const LogoutBreadcrumb = () => {
  return (
    <BreadcrumbItem id="logout" avatar={defaultIcons.logout} name="Logout" />
  );
};
