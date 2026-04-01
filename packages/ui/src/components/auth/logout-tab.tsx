import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const LogoutTab = () => {
  return <TabItem id="logout" avatar={defaultIcons.logout} name="Logout" />;
};
