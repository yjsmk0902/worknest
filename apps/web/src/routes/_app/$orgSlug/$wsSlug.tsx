import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug')({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  return <Outlet />;
}
