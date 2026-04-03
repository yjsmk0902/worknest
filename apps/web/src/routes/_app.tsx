import { useEffect, useMemo } from 'react';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@worknest/ui';
import { apiClient, ApiError } from '../lib/api-client';
import { useAuthStore, type User } from '../stores/auth-store';
import { Sidebar } from '../components/layout/sidebar';
import { useUIStore } from '../stores/ui-store';
import { useGlobalShortcuts } from '../hooks/use-global-shortcuts';
import { KeyboardShortcutsSheet } from '../components/keyboard-shortcuts-sheet';
import { connect, disconnect } from '../lib/websocket';
import { useWebSocket } from '../hooks/use-websocket';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

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

  // Global keyboard shortcuts (Cmd+K, Cmd+/, Cmd+\)
  const { shortcutsSheetOpen, setShortcutsSheetOpen } = useGlobalShortcuts();

  // WebSocket: connect on auth, disconnect on unmount
  const userId = profileQuery.data?.id;

  useEffect(() => {
    if (userId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [userId]);

  // Subscribe to personal user channel
  const userChannels = useMemo(
    () => (userId ? [`user:${userId}`] : []),
    [userId],
  );
  useWebSocket(userChannels);

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
      <KeyboardShortcutsSheet
        open={shortcutsSheetOpen}
        onOpenChange={setShortcutsSheetOpen}
      />
    </div>
  );
}
