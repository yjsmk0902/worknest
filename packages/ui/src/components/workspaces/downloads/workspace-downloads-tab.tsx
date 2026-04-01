import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const WorkspaceDownloadsTab = () => {
  return (
    <TabItem id="downloads" avatar={defaultIcons.downloads} name="Downloads" />
  );
};
