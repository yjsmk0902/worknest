import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const AppAppearanceBreadcrumb = () => {
  return (
    <BreadcrumbItem
      id="appearance"
      avatar={defaultIcons.appearance}
      name="Appearance"
    />
  );
};
