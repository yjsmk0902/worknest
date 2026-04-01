import { createRoute } from '@tanstack/react-router';

import { AuthLayout } from '@worknest/ui/components/auth/auth-layout';
import { rootRoute } from '@worknest/ui/routes/root';

export const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthLayout,
});
