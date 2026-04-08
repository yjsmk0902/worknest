import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Kanban,
  List,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@worknest/ui';
import { useAuthStore } from '../../stores/auth-store';
import { apiClient } from '../../lib/api-client';
import { CreateProjectModal } from '../projects/create-project-modal';
import { CollapsedNavItem } from './sidebar-nav';
import { toast } from '@worknest/ui';

export interface SidebarProject {
  id: string;
  name: string;
  prefix: string;
  iconUrl: string | null;
}

function ProjectSubNav({
  projectId,
  orgSlug,
  wsSlug,
}: {
  projectId: string;
  orgSlug: string;
  wsSlug: string;
}) {
  const base = `/${orgSlug}/${wsSlug}/projects/${projectId}`;

  const items = [
    { icon: <List className="h-4 w-4" />, label: 'Issues', href: `${base}/issues` },
    { icon: <Kanban className="h-4 w-4" />, label: 'Board', href: `${base}/board` },
    { icon: <RefreshCw className="h-4 w-4" />, label: 'Cycles', href: `${base}/cycles` },
    { icon: <Settings className="h-4 w-4" />, label: 'Settings', href: `${base}/settings` },
  ];

  return (
    <div className="ml-4 border-l border-border/50 pl-2">
      {items.map((item) => (
        <Link
          key={item.label}
          to={item.href}
          className="flex h-7 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

export function SidebarProjects({
  orgSlug,
  wsSlug,
}: {
  orgSlug: string;
  wsSlug: string;
}) {
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const wsId = currentWorkspace?.id;

  const [collapsed, setCollapsed] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(),
  );

  const params = useParams({ strict: false }) as { projectId?: string };

  const projectsQuery = useQuery({
    queryKey: ['workspaces', wsId, 'projects', 'sidebar'],
    queryFn: () =>
      apiClient.getList<SidebarProject>(
        `/workspaces/${wsId}/projects/sidebar`,
      ),
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });

  const projects = projectsQuery.data?.data ?? [];

  function toggleProject(projectId: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex flex-1 items-center gap-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Projects
        </button>
      </div>

      {!collapsed && (
        <>
          {projects.map((project) => {
            const isExpanded =
              expandedProjects.has(project.id) ||
              params.projectId === project.id;

            return (
              <div key={project.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleProject(project.id)}
                    className="flex h-8 w-6 items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <Link
                    to={`/${orgSlug}/${wsSlug}/projects/${project.id}/issues`}
                    className="flex flex-1 h-8 items-center gap-2 rounded-md px-1 text-sm transition-colors hover:bg-sidebar-accent"
                  >
                    {project.iconUrl ? (
                      <span className="text-sm">{project.iconUrl}</span>
                    ) : (
                      <Folder className="h-4 w-4" />
                    )}
                    <span className="truncate">{project.name}</span>
                  </Link>
                </div>

                {isExpanded && (
                  <ProjectSubNav
                    projectId={project.id}
                    orgSlug={orgSlug}
                    wsSlug={wsSlug}
                  />
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            <span>프로젝트 추가</span>
          </button>
        </>
      )}

      {wsId && (
        <CreateProjectModal
          workspaceId={wsId}
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />
      )}
    </>
  );
}

export function CollapsedSidebarProjects() {
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const wsId = currentWorkspace?.id;
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? '';
  const wsSlug = params.wsSlug ?? '';

  const projectsQuery = useQuery({
    queryKey: ['workspaces', wsId, 'projects', 'sidebar'],
    queryFn: () =>
      apiClient.getList<SidebarProject>(
        `/workspaces/${wsId}/projects/sidebar`,
      ),
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });

  const projects = projectsQuery.data?.data ?? [];

  return (
    <>
      {projects.map((project) => (
        <Tooltip key={project.id}>
          <TooltipTrigger asChild>
            <Link
              to={
                orgSlug && wsSlug
                  ? `/${orgSlug}/${wsSlug}/projects/${project.id}/issues`
                  : '#'
              }
              className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-sidebar-accent"
            >
              {project.iconUrl ? (
                <span className="text-base">{project.iconUrl}</span>
              ) : (
                <Folder className="h-5 w-5" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{project.name}</TooltipContent>
        </Tooltip>
      ))}
      <CollapsedNavItem
        icon={<Plus className="h-5 w-5" />}
        label="프로젝트 추가"
        onClick={() => {
          if (wsId) {
            setCreateModalOpen(true);
          } else {
            toast('Workspace not loaded yet');
          }
        }}
      />
      {wsId && (
        <CreateProjectModal
          workspaceId={wsId}
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
        />
      )}
    </>
  );
}
