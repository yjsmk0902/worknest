import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Avatar, Skeleton } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import { toast } from '@worknest/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@worknest/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@worknest/ui';
import {
  Bell,
  Check,
  ChevronDown,
  CircleUser,
  Loader2,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Settings,
  Star,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';
import { NotificationBell } from '../notification-bell';
import { CollapsedNavItem, NavItem } from './sidebar-nav';
import { CollapsedSidebarProjects, SidebarProjects } from './sidebar-projects';
import { CollapsedSidebarWiki, SidebarWiki } from './sidebar-wiki';

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);

  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  if (collapsed) {
    return <CollapsedSidebar onToggle={toggleSidebar} />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Main navigation"
        className="fixed left-0 top-0 z-30 flex h-screen w-[240px] flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground"
      >
        {/* Header: Org/WS + bell */}
        <div className="flex items-center gap-1 px-2 pt-3 pb-1">
          <div className="flex-1 min-w-0">
            <OrgWorkspaceSelector collapsed={false} />
          </div>
          <NotificationBell />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-2 pt-1 pb-2">
          {/* My Work */}
          <div className="mb-1 px-2.5 pt-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
              My Work
            </span>
          </div>
          <InboxNavItem orgSlug={orgSlug} wsSlug={wsSlug} />
          <NavItem
            icon={<CircleUser className="h-4 w-4" />}
            label="My Issues"
            href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/issues` : '#'}
          />
          <NavItem
            icon={<Star className="h-4 w-4" />}
            label="Favorites"
            href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/favorites` : '#'}
          />

          <div className="my-2 mx-2.5 border-t border-sidebar-border" />

          {/* Projects */}
          <SidebarProjects orgSlug={orgSlug} wsSlug={wsSlug} />

          <div className="my-2 mx-2.5 border-t border-sidebar-border" />

          {/* Wiki */}
          <SidebarWiki orgSlug={orgSlug} wsSlug={wsSlug} wsId={currentWorkspace?.id} />
        </div>

        {/* Footer: User + collapse */}
        <div className="border-t border-sidebar-border px-2 py-2">
          <div className="flex items-center">
            <div className="flex-1 min-w-0">
              <UserMenu collapsed={false} />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  aria-label="사이드바 접기"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">사이드바 접기</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function CollapsedSidebar({ onToggle }: { onToggle: () => void }) {
  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Main navigation"
        className="fixed left-0 top-0 z-30 flex h-screen w-[48px] flex-col items-center border-r border-sidebar-border bg-sidebar-background py-2 text-sidebar-foreground"
      >
        <OrgWorkspaceSelector collapsed />

        <div className="my-2 w-6 border-t border-sidebar-border" />

        <CollapsedNavItem
          icon={<Bell className="h-[18px] w-[18px]" />}
          label="Inbox"
          href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/inbox` : undefined}
        />
        <CollapsedNavItem
          icon={<CircleUser className="h-[18px] w-[18px]" />}
          label="My Issues"
          href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/issues` : undefined}
        />
        <CollapsedNavItem
          icon={<Star className="h-[18px] w-[18px]" />}
          label="Favorites"
          href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/favorites` : undefined}
        />

        <div className="my-2 w-6 border-t border-sidebar-border" />

        <CollapsedSidebarProjects />

        <div className="my-2 w-6 border-t border-sidebar-border" />

        <CollapsedSidebarWiki />

        <div className="flex-1" />

        <UserMenu collapsed />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              aria-label="사이드바 펼치기"
            >
              <PanelLeft className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">사이드바 펼치기</TooltipContent>
        </Tooltip>
      </nav>
    </TooltipProvider>
  );
}

// -- Sub-components --

function InboxNavItem({ orgSlug, wsSlug }: { orgSlug: string; wsSlug: string }) {
  const unreadQuery = useQuery<{ count: number }>({
    queryKey: ['my', 'notifications', 'unread-count'],
    queryFn: () => apiClient.get<{ count: number }>('/my/notifications/unread-count'),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!(orgSlug && wsSlug),
  });

  return (
    <NavItem
      icon={<Bell className="h-4 w-4" />}
      label="Inbox"
      href={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/inbox` : '#'}
      badge={unreadQuery.data?.count}
    />
  );
}

function OrgWorkspaceSelector({ collapsed }: { collapsed: boolean }) {
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const [orgPopoverOpen, setOrgPopoverOpen] = useState(false);
  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  const orgName = currentOrg?.name;
  const wsName = currentWorkspace?.name;
  const isLoaded = !!orgName && !!wsName;
  const displayOrg = orgName ?? '';
  const displayWs = wsName ?? '';
  const initial = isLoaded ? displayOrg.charAt(0).toUpperCase() : '';

  if (!isLoaded && orgSlug) {
    if (collapsed) {
      return (
        <div className="flex h-9 w-9 items-center justify-center">
          <Skeleton className="h-7 w-7 rounded-lg" />
        </div>
      );
    }
    return (
      <div className="flex h-11 w-full items-center gap-2.5 px-2.5">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            {currentOrg?.logo ? (
              <img
                src={currentOrg.logo}
                alt={displayOrg}
                className="h-7 w-7 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                {initial}
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {displayOrg} · {displayWs}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={orgPopoverOpen} onOpenChange={setOrgPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2.5 hover:bg-sidebar-accent transition-colors"
        >
          {currentOrg?.logo ? (
            <img
              src={currentOrg.logo}
              alt={displayOrg}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
              {initial}
            </div>
          )}
          <div className="flex-1 text-left min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-sidebar-foreground">
              {displayOrg}
            </p>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/50">
              {displayWs}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/30 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-1.5">
        <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/50">
          {displayOrg}
        </p>
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium hover:bg-accent transition-colors"
        >
          <Check className="h-4 w-4 text-primary" />
          <span>{displayWs}</span>
        </button>
        <Separator className="my-1.5" />
        <button
          type="button"
          onClick={() => {
            setOrgPopoverOpen(false);
            toast('Coming soon');
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>새 워크스페이스 만들기</span>
        </button>
        {orgSlug && wsSlug && (
          <Link
            to={`/${orgSlug}/${wsSlug}/settings/org`}
            onClick={() => setOrgPopoverOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground/60 hover:bg-accent hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>조직 설정</span>
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [loggingOut, setLoggingOut] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const name = currentUser?.name ?? 'User';
  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Always redirect to login even if API call fails
    }
    window.location.href = '/login';
  }

  if (loggingOut) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-[13px]">로그아웃 중...</span>
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            <Avatar src={currentUser?.avatarUrl} fallback={name} size="sm" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 hover:bg-sidebar-accent transition-colors"
        >
          <Avatar src={currentUser?.avatarUrl} fallback={name} size="sm" />
          <span className="flex-1 truncate text-left text-[13px] font-medium text-sidebar-foreground">
            {name}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1.5">
        {orgSlug && wsSlug && (
          <>
            <Link
              to={`/${orgSlug}/${wsSlug}/settings/profile`}
              onClick={() => setUserPopoverOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-accent transition-colors"
            >
              <User className="h-4 w-4" />
              <span>프로필</span>
            </Link>
            <Link
              to={`/${orgSlug}/${wsSlug}/settings`}
              onClick={() => setUserPopoverOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              <span>워크스페이스 설정</span>
            </Link>
          </>
        )}
        <Separator className="my-1" />
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-destructive hover:bg-accent transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>로그아웃</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
