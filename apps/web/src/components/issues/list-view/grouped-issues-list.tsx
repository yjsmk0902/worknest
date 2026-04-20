import { useQuery } from '@tanstack/react-query';
import type { IssueOutput, IssueStatusOutput, StatusCategory } from '@worknest/shared';
import { Avatar } from '@worknest/ui';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiClient } from '../../../lib/api-client';
import { PRIORITY_CONFIG, type Priority } from '../../../lib/issue-constants';
import {
  CATEGORY_CONFIG,
  CATEGORY_ORDER,
  CategoryGlyph,
  type GroupCategory,
} from '../../../lib/status-category-config';

interface GroupedIssuesListProps {
  issues: IssueOutput[];
  projectId: string;
  projectPrefix: string;
  activeIssueId?: string | null;
  onRowClick: (issueId: string) => void;
  onAddIssue: (category: GroupCategory) => void;
}

export function GroupedIssuesList({
  issues,
  projectId,
  projectPrefix,
  activeIssueId,
  onRowClick,
  onAddIssue,
}: GroupedIssuesListProps) {
  const statusesQuery = useQuery<{ data: IssueStatusOutput[] }>({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () =>
      apiClient.getList<IssueStatusOutput>(`/projects/${projectId}/statuses`),
    staleTime: 60 * 1000,
  });

  const statusCategoryMap = useMemo(() => {
    const map = new Map<string, StatusCategory>();
    for (const s of statusesQuery.data?.data ?? []) {
      map.set(s.id, s.category as StatusCategory);
    }
    return map;
  }, [statusesQuery.data]);

  // Group issues by category (fallback to 'backlog' if status unknown)
  const grouped = useMemo(() => {
    const out: Record<GroupCategory, IssueOutput[]> = {
      started: [],
      unstarted: [],
      review: [],
      backlog: [],
      completed: [],
      cancelled: [],
    };
    for (const issue of issues) {
      const cat = (issue.statusId && statusCategoryMap.get(issue.statusId)) || 'backlog';
      out[cat as GroupCategory]?.push(issue);
    }
    return out;
  }, [issues, statusCategoryMap]);

  const [collapsed, setCollapsed] = useState<Set<GroupCategory>>(() => {
    const init = new Set<GroupCategory>();
    for (const cat of CATEGORY_ORDER) {
      if (!CATEGORY_CONFIG[cat].defaultOpen) init.add(cat);
    }
    return init;
  });

  const toggle = (cat: GroupCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {CATEGORY_ORDER.map((category) => {
        const rows = grouped[category];
        const config = CATEGORY_CONFIG[category];
        const isCollapsed = collapsed.has(category);

        return (
          <section key={category} aria-label={config.label}>
            {/* Group header */}
            <div className="group sticky top-0 z-[1] flex h-10 items-center gap-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-0)] px-4 text-[13px]">
              <button
                type="button"
                onClick={() => toggle(category)}
                className="grid h-5 w-5 shrink-0 place-items-center text-[color:var(--fg-3)] transition-colors hover:text-[color:var(--fg-1)]"
                aria-label={`${config.label} ${isCollapsed ? '펼치기' : '접기'}`}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              <CategoryGlyph category={category} size={14} />
              <span className="font-medium text-[color:var(--fg-1)]">{config.label}</span>
              <span className="font-mono text-[11px] text-[color:var(--fg-4)]">{rows.length}</span>
              <button
                type="button"
                onClick={() => onAddIssue(category)}
                className="ml-auto grid h-6 w-6 place-items-center rounded-sm text-[color:var(--fg-3)] opacity-0 transition-opacity hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)] group-hover:opacity-100"
                aria-label={`${config.label}에 이슈 추가`}
              >
                <Plus className="h-[14px] w-[14px]" />
              </button>
            </div>

            {/* Rows */}
            {!isCollapsed && rows.length > 0 && (
              <div>
                {rows.map((issue) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    projectPrefix={projectPrefix}
                    statusCategoryMap={statusCategoryMap}
                    active={activeIssueId === issue.id}
                    onClick={() => onRowClick(issue.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────

interface IssueRowProps {
  issue: IssueOutput;
  projectPrefix: string;
  statusCategoryMap: Map<string, StatusCategory>;
  active: boolean;
  onClick: () => void;
}

function IssueRow({ issue, projectPrefix, statusCategoryMap, active, onClick }: IssueRowProps) {
  const priorityKey = (issue.priority || 'none') as Priority;
  const priorityConfig = PRIORITY_CONFIG[priorityKey] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = priorityConfig.icon;
  const issueKey = `${projectPrefix}-${issue.sequenceId}`;
  const category = issue.statusId ? statusCategoryMap.get(issue.statusId) : undefined;
  const labels = issue.labels ?? [];
  const assignees = issue.assignees ?? [];
  const primaryAssignee = assignees[0];
  const extraAssignees = assignees.length - 1;
  const due = issue.dueDate ? formatShortDate(issue.dueDate) : '—';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-[44px] w-full items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 text-left text-[13px] text-[color:var(--fg-1)] transition-colors hover:bg-[color:var(--bg-2)] ${
        active ? 'bg-[color:var(--bg-2)]' : ''
      }`}
    >
      {/* Priority */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <PriorityIcon className="h-[14px] w-[14px]" />
      </span>

      {/* Issue key (mono) */}
      <span className="w-[72px] shrink-0 font-mono text-[11.5px] text-[color:var(--fg-4)]">
        {issueKey}
      </span>

      {/* Status */}
      <CategoryGlyph
        category={category}
        color={issue.status?.color}
        size={13}
      />

      {/* Title */}
      <span className="min-w-0 flex-1 truncate">{issue.title}</span>

      {/* Labels (max 2 visible) */}
      {labels.length > 0 && (
        <span className="flex shrink-0 items-center gap-1">
          {labels.slice(0, 2).map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-[5px] rounded-md bg-[color:var(--bg-3)] px-[8px] py-[1px] text-[11.5px] text-[color:var(--fg-2)]"
            >
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ backgroundColor: l.label.color }}
              />
              {l.label.name}
            </span>
          ))}
          {labels.length > 2 && (
            <span className="font-mono text-[11px] text-[color:var(--fg-4)]">
              +{labels.length - 2}
            </span>
          )}
        </span>
      )}

      {/* Due date */}
      <span className="shrink-0 font-mono text-[11.5px] text-[color:var(--fg-4)]">{due}</span>

      {/* Assignee */}
      {primaryAssignee ? (
        <span className="relative shrink-0">
          <Avatar
            src={primaryAssignee.user.avatarUrl}
            fallback={primaryAssignee.user.name}
            size="sm"
          />
          {extraAssignees > 0 && (
            <span className="absolute -right-1 -top-1 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-[color:var(--bg-4)] px-1 font-mono text-[9px] text-[color:var(--fg-2)]">
              +{extraAssignees}
            </span>
          )}
        </span>
      ) : (
        <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-[color:var(--border)]" />
      )}
    </button>
  );
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}
