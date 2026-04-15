import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-[560px] px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Worknest</h1>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
