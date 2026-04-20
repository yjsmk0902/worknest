import { createColumnHelper } from '@tanstack/react-table';
import type { IssueOutput } from '@worknest/shared';
import { cn } from '@worknest/ui';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@worknest/ui';
import { AssigneeCell, PriorityCell, StatusCell, TypeCell } from './inline-edit-cells';

const MAX_SELECTION = 50;

// ── Date formatting ─────────────────────────────────────────────────────

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date =
    now.getFullYear() === d.getFullYear()
      ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
      : `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return hasTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

function formatDueDate(dateStr: string | null): {
  text: string;
  className: string;
} {
  if (!dateStr) {
    return { text: '\u2014', className: 'text-muted-foreground/50' };
  }

  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = formatDateTime(dateStr);

  if (diffDays < 0) {
    return { text: formatted, className: 'text-destructive font-medium' };
  }
  if (diffDays <= 3) {
    return { text: formatted, className: 'text-orange-500' };
  }
  return { text: formatted, className: 'text-muted-foreground' };
}

// ── Column definitions ──────────────────────────────────────────────────

const columnHelper = createColumnHelper<IssueOutput>();

export function createIssueColumns(projectPrefix: string, projectId: string) {
  return [
    // Checkbox column
    columnHelper.display({
      id: 'select',
      size: 40,
      header: ({ table }) => {
        const allRows = table.getRowModel().rows;
        const selectedCount = Object.keys(table.getState().rowSelection).length;
        const isAllSelected = table.getIsAllPageRowsSelected();
        const isSomeSelected = table.getIsSomePageRowsSelected();
        const isOverLimit = allRows.length > MAX_SELECTION;

        return (
          <div className="flex items-center justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <input
                    type="checkbox"
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = isSomeSelected && !isAllSelected;
                      }
                    }}
                    checked={isAllSelected}
                    onChange={(e) => {
                      if (e.target.checked && isOverLimit) {
                        // Select only the first MAX_SELECTION rows
                        const next: Record<string, boolean> = {};
                        for (let i = 0; i < Math.min(allRows.length, MAX_SELECTION); i++) {
                          const row = allRows[i];
                          if (row?.getCanSelect()) {
                            next[row.id] = true;
                          }
                        }
                        table.setRowSelection(next);
                      } else {
                        table.toggleAllPageRowsSelected(e.target.checked);
                      }
                    }}
                    className="h-4 w-4 rounded border-border accent-primary"
                    aria-label="전체 선택"
                  />
                </TooltipTrigger>
                {isOverLimit && selectedCount < MAX_SELECTION && (
                  <TooltipContent>최대 {MAX_SELECTION}건까지 선택 가능</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
      cell: ({ row, table }) => {
        const selectedCount = Object.keys(table.getState().rowSelection).length;
        const isSelected = row.getIsSelected();
        const atLimit = selectedCount >= MAX_SELECTION && !isSelected;

        return (
          <div className="flex items-center justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!row.getCanSelect() || atLimit}
                    onChange={row.getToggleSelectedHandler()}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 rounded border-border accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`${projectPrefix}-${row.original.sequenceId} 선택`}
                  />
                </TooltipTrigger>
                {atLimit && <TooltipContent>최대 {MAX_SELECTION}건까지 선택 가능</TooltipContent>}
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
    }),

    // Priority column
    columnHelper.display({
      id: 'priority',
      size: 40,
      header: () => null,
      cell: ({ row }) => <PriorityCell issue={row.original} projectId={projectId} />,
    }),

    // Issue key column
    columnHelper.accessor('sequenceId', {
      id: 'issueKey',
      size: 80,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">키</span>
      ),
      cell: ({ row }) => {
        const isTemp = row.original.id.startsWith('temp-');
        const key = isTemp ? '...' : `${projectPrefix}-${row.original.sequenceId}`;
        return <span className="font-mono text-xs text-muted-foreground">{key}</span>;
      },
    }),

    // Title column (with inline labels)
    columnHelper.accessor('title', {
      id: 'title',
      size: undefined, // flex-1
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">제목</span>
      ),
      cell: ({ row }) => {
        const labels = row.original.labels ?? [];
        return (
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate text-sm">{row.original.title}</span>
            {labels.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {labels.slice(0, 3).map((l) => (
                  <span
                    key={l.id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-none"
                    style={{
                      backgroundColor: `${l.label.color}20`,
                      color: l.label.color,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: l.label.color }}
                    />
                    {l.label.name}
                  </span>
                ))}
                {labels.length > 3 && (
                  <span className="text-xs text-muted-foreground">+{labels.length - 3}</span>
                )}
              </div>
            )}
          </div>
        );
      },
    }),

    // Status column
    columnHelper.display({
      id: 'status',
      size: 120,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">상태</span>
      ),
      cell: ({ row }) => <StatusCell issue={row.original} projectId={projectId} />,
    }),

    // Type column
    columnHelper.display({
      id: 'type',
      size: 100,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">타입</span>
      ),
      cell: ({ row }) => <TypeCell issue={row.original} projectId={projectId} />,
    }),

    // Assignee column
    columnHelper.display({
      id: 'assignee',
      size: 140,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">담당자</span>
      ),
      cell: ({ row }) => <AssigneeCell issue={row.original} projectId={projectId} showName />,
    }),

    // Cycle column
    columnHelper.display({
      id: 'cycle',
      size: 120,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">사이클</span>
      ),
      cell: ({ row }) => {
        const cycle = row.original.cycle;
        if (!cycle) {
          return <span className="text-xs text-muted-foreground/50">{'\u2014'}</span>;
        }
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs leading-none truncate max-w-full',
              cycle.status === 'active'
                ? 'bg-primary/10 text-primary'
                : cycle.status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full shrink-0',
                cycle.status === 'active'
                  ? 'bg-primary'
                  : cycle.status === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-muted-foreground',
              )}
            />
            {cycle.name}
          </span>
        );
      },
    }),

    // Start date column
    columnHelper.display({
      id: 'startDate',
      size: 120,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">시작일</span>
      ),
      cell: ({ row }) => {
        const text = formatDateTime(row.original.startDate);
        return (
          <span
            className={cn(
              'text-xs',
              row.original.startDate ? 'text-muted-foreground' : 'text-muted-foreground/50',
            )}
          >
            {text}
          </span>
        );
      },
    }),

    // Due date column
    columnHelper.accessor('dueDate', {
      id: 'dueDate',
      size: 120,
      header: () => (
        <span className="text-xs font-medium tracking-wider text-muted-foreground">마감일</span>
      ),
      cell: ({ row }) => {
        const { text, className } = formatDueDate(row.original.dueDate);
        return <span className={cn('text-xs', className)}>{text}</span>;
      },
    }),
  ];
}
