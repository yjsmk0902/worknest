import { createRoute } from '@tanstack/react-router';
import { z } from 'zod/v4';

import { Reset } from '@worknest/ui/components/auth/reset';
import { ResetTab } from '@worknest/ui/components/auth/reset-tab';
import { authRoute } from '@worknest/ui/routes/auth';

const resetSearchSchema = z.object({
  id: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const resetRoute = createRoute({
  getParentRoute: () => authRoute,
  path: '/reset',
  component: Reset,
  validateSearch: resetSearchSchema,
  context: () => {
    return {
      tab: <ResetTab />,
    };
  },
});
