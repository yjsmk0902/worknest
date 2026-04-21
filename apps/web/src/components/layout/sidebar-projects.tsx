import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Tooltip, TooltipContent, TooltipTrigger } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { toast } from '@worknest/ui';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderKanban,
  GanttChart,
  Kanban,
  List,
  Plus,
  BookOpen,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { CreateProjectModal } from '../projects/create-project-modal';
import { CollapsedNavItem } from './sidebar-nav';

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

  const issueSubItems = [
    { icon: <List className="h-3.5 w-3.5" />, label: '리스트', href: `${base}/issues` },
    { icon: <Kanban className="h-3.5 w-3.5" />, label: '보드', href: `${base}/board` },
    { icon: <GanttChart className="h-3.5 w-3.5" />, label: '간트', href: `${base}/gantt` },
  ];

  const otherItems = [
    { icon: <RefreshCw className="h-3.5 w-3.5" />, label: '사이클', href: `${base}/cycles` },
    { icon: <BookOpen className="h-3.5 w-3.5" />, label: '위키', href: `${base}/wiki` },
    { icon: <Settings className="h-3.5 w-3.5" />, label: '설정', href: `${base}/settings` },
  ];

  const linkClass =
    'flex h-[30px] items-center gap-2 rounded-md px-2 text-[12px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:font-semibold';

  return (
    <div className="ml-7 border-l border-sidebar-border pl-2 py-0.5">
      {/* Issues group — always expanded */}
      <div className="flex h-[30px] items-center gap-2 px-2 text-[12px] font-medium text-sidebar-foreground/60">
        <List className="h-3.5 w-3.5" />
        <span>이슈</span>
      </div>
      <div className="ml-5 border-l border-sidebar-border/50 pl-2">
        {issueSubItems.map((item) => (
          <Link key={item.label} to={item.href} className={linkClass}>
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {otherItems.map((item) => (
        <Link key={item.label} to={item.href} className={linkClass}>
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

  const [sectionOpen, setSectionOpen] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const params = useParams({ strict: false }) as { projectId?: string };

  const projectsQuery = useQuery({
    queryKey: ['workspaces', wsId, 'projects', 'sidebar'],
    queryFn: () => apiClient.getList<SidebarProject>(`/workspaces/${wsId}/projects/sidebar`),
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
      {/* Section header — matches nav-item scale with chevron + icon */}
      <div className="group relative flex items-center">
        <button
          type="button"
          onClick={() => setSectionOpen((v) => !v)}
          className="flex h-7 flex-1 items-center gap-[10px] rounded-md px-2 text-[13px] text-[color:var(--fg-mid)] transition-colors hover:bg-[color:var(--bg-hover)] hover:text-foreground"
        >
          <span className="grid h-[15px] w-[15px] shrink-0 place-items-center text-[color:var(--fg-dim)]">
            <FolderKanban className="h-[15px] w-[15px]" />
          </span>
          <span className="flex-1 text-left">프로젝트</span>
          {sectionOpen ? (
            <ChevronDown className="h-[14px] w-[14px] text-[color:var(--fg-faint)]" />
          ) : (
            <ChevronRight className="h-[14px] w-[14px] text-[color:var(--fg-faint)]" />
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCreateModalOpen(true);
          }}
          className="absolute right-1 grid h-5 w-5 place-items-center rounded text-[color:var(--fg-dim)] opacity-0 transition-opacity hover:bg-[color:var(--bg-hover)] hover:text-foreground group-hover:opacity-100"
          aria-label="프로젝트 추가"
        >
          <Plus className="h-[13px] w-[13px]" />
        </button>
      </div>

      {sectionOpen && (
        <>
          {projects.map((project) => {
            const isExpanded = expandedProjects.has(project.id);

            return (
              <div key={project.id}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleProject(project.id)}
                    className="flex h-[34px] w-5 items-center justify-center shrink-0 ml-1 text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleProject(project.id)}
                    className={cn(
                      'flex flex-1 h-[34px] items-center gap-2 rounded-lg px-2 text-[13px] font-medium transition-colors text-left',
                      params.projectId === project.id
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent',
                    )}
                  >
                    {project.iconUrl &&
                    (project.iconUrl.startsWith('/api/') || project.iconUrl.startsWith('http')) ? (
                      <img
                        src={project.iconUrl}
                        alt=""
                        className="h-4 w-4 rounded object-cover shrink-0"
                      />
                    ) : project.iconUrl ? (
                      <span className="text-[14px] shrink-0">{project.iconUrl}</span>
                    ) : (
                      <Folder className="h-4 w-4 text-sidebar-foreground/40 shrink-0" />
                    )}
                    <span className="truncate">{project.name}</span>
                  </button>
                </div>

                {isExpanded && (
                  <ProjectSubNav projectId={project.id} orgSlug={orgSlug} wsSlug={wsSlug} />
                )}
              </div>
            );
          })}

          {projects.length === 0 && (
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>프로젝트 추가</span>
            </button>
          )}
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
    queryFn: () => apiClient.getList<SidebarProject>(`/workspaces/${wsId}/projects/sidebar`),
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
              to={orgSlug && wsSlug ? `/${orgSlug}/${wsSlug}/projects/${project.id}/issues` : '#'}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              {project.iconUrl &&
              (project.iconUrl.startsWith('/api/') || project.iconUrl.startsWith('http')) ? (
                <img src={project.iconUrl} alt="" className="h-5 w-5 rounded object-cover" />
              ) : project.iconUrl ? (
                <span className="text-base">{project.iconUrl}</span>
              ) : (
                <Folder className="h-[18px] w-[18px]" />
              )}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{project.name}</TooltipContent>
        </Tooltip>
      ))}
      <CollapsedNavItem
        icon={<Plus className="h-[18px] w-[18px]" />}
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
