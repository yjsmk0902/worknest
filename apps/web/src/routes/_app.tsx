import { useQuery } from '@tanstack/react-query';
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Skeleton } from '@worknest/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CommandPalette } from '../components/command-palette/command-palette';
import { KeyboardShortcutsSheet } from '../components/keyboard-shortcuts-sheet';
import { Sidebar } from '../components/layout/sidebar';
import { useGlobalShortcuts } from '../hooks/use-global-shortcuts';
import { useMediaQuery } from '../hooks/use-media-query';
import { useWebSocket } from '../hooks/use-websocket';
import { ApiError, apiClient } from '../lib/api-client';
import { connect, disconnect } from '../lib/websocket';
import { type User, useAuthStore } from '../stores/auth-store';
import { useUIStore } from '../stores/ui-store';

export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);

  // Auto-collapse sidebar at 1024-1279px, auto-expand above 1280px
  const isMediumViewport = useMediaQuery('(min-width: 1024px) and (max-width: 1279px)');
  const isLargeViewport = useMediaQuery('(min-width: 1280px)');

  useEffect(() => {
    if (isMediumViewport && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      // Track that the collapse was system-initiated
      try {
        sessionStorage.setItem('sidebar-system-collapsed', 'true');
      } catch {
        // sessionStorage unavailable
      }
    }
  }, [isMediumViewport, sidebarCollapsed, setSidebarCollapsed]);

  useEffect(() => {
    if (isLargeViewport && sidebarCollapsed) {
      // Only auto-expand if the collapse was system-initiated, not user-initiated
      try {
        if (sessionStorage.getItem('sidebar-system-collapsed') === 'true') {
          sessionStorage.removeItem('sidebar-system-collapsed');
          setSidebarCollapsed(false);
        }
      } catch {
        // sessionStorage unavailable
      }
    }
  }, [isLargeViewport, sidebarCollapsed, setSidebarCollapsed]);

  const profileQuery = useQuery<User>({
    queryKey: ['my', 'profile'],
    queryFn: () => apiClient.get('/my/profile'),
    retry: false,
  });

  // Check if user has any organizations
  const orgsQuery = useQuery({
    queryKey: ['organizations'],
    queryFn: () => apiClient.getList<{ id: string; slug: string }>('/organizations'),
    enabled: !!profileQuery.data,
    retry: false,
  });

  // Auth guard: redirect to login on 401
  useEffect(() => {
    if (profileQuery.error instanceof ApiError && profileQuery.error.status === 401) {
      navigate({ to: '/login' });
    }
  }, [profileQuery.error, navigate]);

  // Onboarding guard: redirect to onboarding if no organizations
  useEffect(() => {
    if (orgsQuery.data && orgsQuery.data.data?.length === 0) {
      navigate({ to: '/onboarding' });
    }
  }, [orgsQuery.data, navigate]);

  // Auto-redirect to first workspace when user has orgs but is on a non-workspace route
  const [autoRedirecting, setAutoRedirecting] = useState(false);
  const redirectingRef = useRef(false);
  useEffect(() => {
    if (redirectingRef.current) return;
    const orgs = orgsQuery.data?.data;
    if (!orgs || orgs.length === 0) return;
    const path = window.location.pathname;
    if (path !== '/' && path !== '/orgs') return;
    redirectingRef.current = true;
    setAutoRedirecting(true);
    const firstOrg = orgs[0];
    apiClient
      .getList<{ id: string; slug: string }>(`/organizations/${firstOrg.id}/workspaces`)
      .then((res) => {
        if (res.data.length > 0) {
          const ws = res.data[0];
          window.location.href = `/${firstOrg.slug}/${ws.slug}`;
        } else {
          redirectingRef.current = false;
          setAutoRedirecting(false);
        }
      })
      .catch(() => {
        redirectingRef.current = false;
        setAutoRedirecting(false);
      });
  }, [orgsQuery.data]);

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
  const userChannels = useMemo(() => (userId ? [`user:${userId}`] : []), [userId]);
  useWebSocket(userChannels);

  // Show loading while checking auth, onboarding status, or auto-redirecting
  if (profileQuery.isLoading || (profileQuery.data && orgsQuery.isLoading) || autoRedirecting) {
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
      <KeyboardShortcutsSheet open={shortcutsSheetOpen} onOpenChange={setShortcutsSheetOpen} />
      <CommandPalette />
    </div>
  );
}
