import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const InfoTab = () => {
  return <TabItem id="info" avatar={defaultIcons.apps} name="Info" />;
};
