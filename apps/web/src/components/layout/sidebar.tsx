import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  ChevronDown,
  CircleUser,
  LogOut,
  Plus,
  Settings,
  Star,
  User,
  Check,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { Avatar } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@worknest/ui';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@worknest/ui';
import { useUIStore } from '../../stores/ui-store';
import { useAuthStore } from '../../stores/auth-store';
import { apiClient } from '../../lib/api-client';
import { SectionLabel, NavItem, CollapsedNavItem } from './sidebar-nav';
import {
  SidebarProjects,
  CollapsedSidebarProjects,
} from './sidebar-projects';
import { SidebarWiki, CollapsedSidebarWiki } from './sidebar-wiki';
import { NotificationBell } from '../notification-bell';

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentOrg = useAuthStore((s) => s.currentOrg);
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
        role="navigation"
        aria-label="Main navigation"
        className="fixed left-0 top-0 z-30 flex h-screen w-[240px] flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground transition-all duration-150 ease-in-out"
      >
        {/* Org/WS selector + notification bell */}
        <div className="flex items-center">
          <div className="flex-1 min-w-0">
            <OrgWorkspaceSelector collapsed={false} />
          </div>
          <div className="shrink-0 pr-2">
            <NotificationBell />
          </div>
        </div>

        {/* Main nav content */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* My Work section */}
          <SectionLabel>My Work</SectionLabel>
          <InboxNavItem orgSlug={orgSlug} wsSlug={wsSlug} />
          <NavItem
            icon={<CircleUser className="h-4 w-4" />}
            label="My Issues"
            href={
              orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/my/issues` : '#'
            }
          />
          <NavItem
            icon={<Star className="h-4 w-4" />}
            label="Favorites"
            href={
              orgSlug && wsSlug
                ? `/${orgSlug}/${wsSlug}/my/favorites`
                : '#'
            }
          />

          <div className="my-2" />

          {/* Projects section */}
          <SidebarProjects orgSlug={orgSlug} wsSlug={wsSlug} />

          <div className="my-2" />

          {/* Wiki section */}
          <SidebarWiki orgSlug={orgSlug} wsSlug={wsSlug} wsId={currentWorkspace?.id} />
        </div>

        {/* Bottom: user area + toggle */}
        <div className="border-t border-sidebar-border px-2 py-2">
          <UserMenu collapsed={false} />
          <button
            type="button"
            onClick={toggleSidebar}
            className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
            <span>사이드바 접기</span>
          </button>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function CollapsedSidebar({ onToggle }: { onToggle: () => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="fixed left-0 top-0 z-30 flex h-screen w-[48px] flex-col items-center border-r border-sidebar-border bg-sidebar-background py-2 text-sidebar-foreground transition-all duration-150 ease-in-out"
      >
        {/* Org/WS initial */}
        <OrgWorkspaceSelector collapsed />

        <div className="my-1 w-8 border-t border-sidebar-border" />

        {/* My Work icons */}
        <CollapsedNavItem icon={<Bell className="h-5 w-5" />} label="Inbox" />
        <CollapsedNavItem
          icon={<CircleUser className="h-5 w-5" />}
          label="My Issues"
        />
        <CollapsedNavItem
          icon={<Star className="h-5 w-5" />}
          label="Favorites"
        />

        <div className="my-1 w-8 border-t border-sidebar-border" />

        {/* Projects */}
        <CollapsedSidebarProjects />

        <div className="my-1 w-8 border-t border-sidebar-border" />

        {/* Wiki */}
        <CollapsedSidebarWiki />

        <div className="flex-1" />

        {/* User + toggle */}
        <div className="my-1 w-8 border-t border-sidebar-border" />
        <UserMenu collapsed />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onToggle}
              className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-sidebar-accent"
              aria-label="Expand sidebar"
            >
              <PanelLeft className="h-5 w-5" />
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
    queryFn: () =>
      apiClient.get<{ count: number }>('/my/notifications/unread-count'),
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

  const orgName = currentOrg?.name ?? 'Organization';
  const wsName = currentWorkspace?.name ?? 'Workspace';
  const initials =
    orgName.charAt(0).toUpperCase() + (wsName.charAt(0) ?? '').toUpperCase();

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold hover:bg-sidebar-accent"
          >
            {initials.charAt(0)}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {orgName} / {wsName}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-12 w-full items-center gap-2 px-3 hover:bg-sidebar-accent"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            {initials.charAt(0)}
          </div>
          <div className="flex-1 text-left">
            <p className="truncate text-sm font-medium">{orgName}</p>
            <p className="truncate text-xs text-muted-foreground">{wsName}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-2">
        <p className="px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {orgName}
        </p>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Check className="h-4 w-4 text-primary" />
          <span>{wsName}</span>
        </button>
        <Separator className="my-2" />
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          <span>새 워크스페이스 만들기</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>조직 설정</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const name = currentUser?.name ?? 'User';

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center"
          >
            <Avatar
              src={currentUser?.avatarUrl}
              fallback={name}
              size="sm"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-full items-center gap-2 rounded-md px-3 hover:bg-sidebar-accent"
        >
          <Avatar
            src={currentUser?.avatarUrl}
            fallback={name}
            size="sm"
          />
          <span className="flex-1 truncate text-left text-sm">{name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          <User className="h-4 w-4" />
          <span>프로필</span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
        >
          <Settings className="h-4 w-4" />
          <span>워크스페이스 설정</span>
        </button>
        <Separator className="my-1" />
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          <span>로그아웃</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
