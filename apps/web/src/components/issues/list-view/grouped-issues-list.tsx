import type { IssueOutput, StatusCategory } from '@worknest/shared';
import { Avatar } from '@worknest/ui';
import type { RowSelectionState } from '@tanstack/react-table';
import { ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
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
  selectionMode?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (updater: (prev: RowSelectionState) => RowSelectionState) => void;
}

export function GroupedIssuesList({
  issues,
  projectPrefix,
  activeIssueId,
  onRowClick,
  onAddIssue,
  selectionMode = false,
  rowSelection = {},
  onRowSelectionChange,
}: GroupedIssuesListProps) {
  // Group issues by their status.category (now emitted by the API directly).
  // Issues with no status fall into backlog.
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
      const cat = (issue.status?.category as GroupCategory | undefined) || 'backlog';
      out[cat]?.push(issue);
    }
    return out;
  }, [issues]);

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

  const toggleRow = (issueId: string) => {
    onRowSelectionChange?.((prev) => {
      const next = { ...prev };
      if (next[issueId]) delete next[issueId];
      else next[issueId] = true;
      return next;
    });
  };

  const toggleGroup = (rows: IssueOutput[], allSelected: boolean) => {
    onRowSelectionChange?.((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (allSelected) delete next[r.id];
        else next[r.id] = true;
      }
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {CATEGORY_ORDER.map((category) => {
        const rows = grouped[category];
        const config = CATEGORY_CONFIG[category];
        const isCollapsed = collapsed.has(category);

        const groupAllSelected = rows.length > 0 && rows.every((r) => rowSelection[r.id]);
        const groupSomeSelected = rows.some((r) => rowSelection[r.id]);

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
              {selectionMode && rows.length > 0 && (
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[color:var(--accent-bg)]"
                  ref={(el) => {
                    if (el) el.indeterminate = groupSomeSelected && !groupAllSelected;
                  }}
                  checked={groupAllSelected}
                  onChange={() => toggleGroup(rows, groupAllSelected)}
                  aria-label={`${config.label} 전체 선택`}
                />
              )}
              <CategoryGlyph category={category} size={14} />
              <span className="font-medium text-[color:var(--fg-1)]">{config.label}</span>
              <span className="inline-flex h-[18px] min-w-[20px] items-center justify-center rounded-md bg-[color:var(--bg-3)] px-[6px] font-mono text-[11px] text-[color:var(--fg-2)]">
                {rows.length}
              </span>
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
                    active={activeIssueId === issue.id}
                    onClick={() =>
                      selectionMode ? toggleRow(issue.id) : onRowClick(issue.id)
                    }
                    selectionMode={selectionMode}
                    selected={!!rowSelection[issue.id]}
                    onToggleSelect={() => toggleRow(issue.id)}
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

export interface IssueRowProps {
  issue: IssueOutput;
  projectPrefix: string;
  active: boolean;
  onClick: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Show status name next to icon (for flat lists without group headers). */
  showStatusName?: boolean;
  /** Render a grip drag handle at the start and mark the row draggable. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
}

export function IssueRow({
  issue,
  projectPrefix,
  active,
  onClick,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  showStatusName = false,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDropTarget = false,
}: IssueRowProps) {
  const priorityKey = (issue.priority || 'none') as Priority;
  const priorityConfig = PRIORITY_CONFIG[priorityKey] ?? PRIORITY_CONFIG.none;
  const PriorityIcon = priorityConfig.icon;
  const issueKey = `${projectPrefix}-${issue.sequenceId}`;
  const category = issue.status?.category as StatusCategory | undefined;
  const labels = issue.labels ?? [];
  const assignees = issue.assignees ?? [];
  const primaryAssignee = assignees[0];
  const extraAssignees = assignees.length - 1;
  const due = issue.dueDate ? formatShortDate(issue.dueDate) : '—';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex h-[44px] w-full cursor-pointer select-none items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 text-left text-[13px] text-[color:var(--fg-1)] transition-colors hover:bg-[color:var(--bg-2)] ${
        active || selected ? 'bg-[color:var(--bg-2)]' : ''
      } ${isDragging ? 'opacity-30' : ''} ${
        isDropTarget ? 'border-t-2 border-t-[color:var(--accent-bg)]' : ''
      }`}
    >
      {draggable && (
        <span
          className="-ml-1 flex w-4 shrink-0 cursor-grab items-center justify-center text-[color:var(--fg-4)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
          aria-hidden="true"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}

      {selectionMode && (
        <input
          type="checkbox"
          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[color:var(--accent-bg)]"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label="이슈 선택"
        />
      )}

      {/* Priority */}
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        <PriorityIcon className="h-[14px] w-[14px]" />
      </span>

      {/* Issue key (mono) */}
      <span className="w-[72px] shrink-0 font-mono text-[11.5px] text-[color:var(--fg-4)]">
        {issueKey}
      </span>

      {/* Status */}
      <span className="flex shrink-0 items-center gap-1.5">
        <CategoryGlyph category={category} color={issue.status?.color} size={13} />
        {showStatusName && issue.status?.name && (
          <span className="text-[12.5px] text-[color:var(--fg-2)]">{issue.status.name}</span>
        )}
      </span>

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
    </div>
  );
}

export function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}
