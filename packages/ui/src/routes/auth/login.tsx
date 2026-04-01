import { createRoute } from '@tanstack/react-router';

import { Login } from '@worknest/ui/components/auth/login';
import { LoginTab } from '@worknest/ui/components/auth/login-tab';
import { authRoute } from '@worknest/ui/routes/auth';

export const loginRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/login',
  component: Login,
  context: () => {
    return {
      tab: <LoginTab />,
    };
  },
});
