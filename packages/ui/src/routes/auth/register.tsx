import { createRoute } from '@tanstack/react-router';

import { Register } from '@worknest/ui/components/auth/register';
import { RegisterTab } from '@worknest/ui/components/auth/register-tab';
import { authRoute } from '@worknest/ui/routes/auth';

export const registerRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/register',
  component: Register,
  context: () => {
    return {
      tab: <RegisterTab />,
    };
  },
});
