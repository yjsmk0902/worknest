import { createRootRoute } from '@tanstack/react-router';

import { AppNotFound } from '@worknest/ui/components/app/app-not-found';

export const rootRoute = createRootRoute({
  notFoundComponent: AppNotFound,
});
