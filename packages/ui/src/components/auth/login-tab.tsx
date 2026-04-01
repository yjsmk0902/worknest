import { Tab } from '@worknest/ui/components/layouts/tabs/tab';
import { defaultIcons } from '@worknest/ui/lib/assets';

export const LoginTab = () => {
  return <Tab id="login" avatar={defaultIcons.login} name="Login" />;
};
