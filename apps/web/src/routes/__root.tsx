import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Toaster } from '@worknest/ui';
import { UnsupportedViewport } from '../components/unsupported-viewport';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <UnsupportedViewport />
      <Outlet />
      <Toaster position="bottom-right" />
    </>
  );
}
