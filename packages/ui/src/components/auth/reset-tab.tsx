import { Tab } from '@worknest/ui/components/layouts/tabs/tab';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const ResetTab = () => {
  return <Tab id="reset" avatar={defaultIcons.login} name="Reset Password" />;
};
