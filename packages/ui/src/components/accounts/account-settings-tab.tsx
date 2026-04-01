import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const AccountSettingsTab = () => {
  return (
    <TabItem
      id="settings"
      avatar={defaultIcons.settings}
      name="Account Settings"
    />
  );
};
