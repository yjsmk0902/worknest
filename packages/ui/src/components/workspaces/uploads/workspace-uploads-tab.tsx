import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const WorkspaceUploadsTab = () => {
  return <TabItem id="uploads" avatar={defaultIcons.uploads} name="Uploads" />;
};
