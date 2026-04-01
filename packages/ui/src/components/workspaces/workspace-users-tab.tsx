import { TabItem } from '@worknest/ui/components/layouts/tabs/tab-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const WorkspaceUsersTab = () => {
  return <TabItem id="users" avatar={defaultIcons.users} name="Users" />;
};
