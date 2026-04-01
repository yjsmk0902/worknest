import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const AppAppearanceTab = () => {
  return (
    <TabItem
      id="appearance"
      avatar={defaultIcons.appearance}
      name="Appearance"
    />
  );
};
