import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const AccountSettingsBreadcrumb = () => {
  return (
    <BreadcrumbItem
      id="settings"
      avatar={defaultIcons.settings}
      name="Account Settings"
    />
  );
};
