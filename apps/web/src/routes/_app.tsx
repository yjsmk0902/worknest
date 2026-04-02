import { useEffect } from 'react';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@worknest/ui';
import { apiClient, ApiError } from '../lib/api-client';
import { useAuthStore, type User } from '../stores/auth-store';
import { Sidebar } from '../components/layout/sidebar';
import { useUIStore } from '../stores/ui-store';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const profileQuery = useQuery<User>({
    queryKey: ['my', 'profile'],
    queryFn: () => apiClient.get('/my/profile'),
    retry: false,
  });

  // Auth guard: redirect to login on 401
  useEffect(() => {
    if (
      profileQuery.error instanceof ApiError &&
      profileQuery.error.status === 401
    ) {
      navigate({ to: '/login' });
    }
  }, [profileQuery.error, navigate]);

  // Sync user to auth store
  useEffect(() => {
    if (profileQuery.data) {
      setCurrentUser(profileQuery.data);
    }
  }, [profileQuery.data, setCurrentUser]);

  // Cmd+\ sidebar toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Show loading while checking auth
  if (profileQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="mx-auto h-4 w-32" />
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect will happen)
  if (profileQuery.isError) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main
        className="flex flex-1 flex-col overflow-hidden transition-all duration-150 ease-in-out"
        style={{
          marginLeft: sidebarCollapsed ? '48px' : '240px',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
