import { createColumnHelper } from '@tanstack/react-table';
import { cn } from '@worknest/ui';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@worknest/ui';
import { StatusCell, PriorityCell, AssigneeCell } from './inline-edit-cells';
import type { IssueOutput } from '@worknest/shared';

const MAX_SELECTION = 50;

// ── Due date formatting ─────────────────────────────────────────────────

function formatDueDate(dateStr: string | null): {
  text: string;
  className: string;
} {
  if (!dateStr) {
    return { text: '\u2014', className: 'text-muted-foreground/50' };
  }

  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  const sameYear = date.getFullYear() === now.getFullYear();
  const formatted = sameYear
    ? `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`
    : `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;

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

export function createIssueColumns(
  projectPrefix: string,
  projectId: string,
) {
  return [
    // Checkbox column
    columnHelper.display({
      id: 'select',
      size: 40,
      header: ({ table }) => {
        const allRows = table.getRowModel().rows;
        const selectedCount = Object.keys(
          table.getState().rowSelection,
        ).length;
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
                        for (
                          let i = 0;
                          i < Math.min(allRows.length, MAX_SELECTION);
                          i++
                        ) {
                          const row = allRows[i];
                          if (row && row.getCanSelect()) {
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
                  <TooltipContent>
                    최대 {MAX_SELECTION}건까지 선택 가능
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      },
      cell: ({ row, table }) => {
        const selectedCount = Object.keys(
          table.getState().rowSelection,
        ).length;
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
                {atLimit && (
                  <TooltipContent>
                    최대 {MAX_SELECTION}건까지 선택 가능
                  </TooltipContent>
                )}
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
      cell: ({ row }) => (
        <PriorityCell issue={row.original} projectId={projectId} />
      ),
    }),

    // Issue key column
    columnHelper.accessor('sequenceId', {
      id: 'issueKey',
      size: 80,
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Key
        </span>
      ),
      cell: ({ row }) => {
        const isTemp = row.original.id.startsWith('temp-');
        const key = isTemp
          ? '...'
          : `${projectPrefix}-${row.original.sequenceId}`;
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {key}
          </span>
        );
      },
    }),

    // Title column
    columnHelper.accessor('title', {
      id: 'title',
      size: undefined, // flex-1
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Title
        </span>
      ),
      cell: ({ row }) => (
        <span className="truncate text-sm">{row.original.title}</span>
      ),
    }),

    // Status column
    columnHelper.display({
      id: 'status',
      size: 120,
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Status
        </span>
      ),
      cell: ({ row }) => (
        <StatusCell issue={row.original} projectId={projectId} />
      ),
    }),

    // Assignee column
    columnHelper.display({
      id: 'assignee',
      size: 80,
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Assignee
        </span>
      ),
      cell: ({ row }) => (
        <AssigneeCell issue={row.original} projectId={projectId} />
      ),
    }),

    // Due date column
    columnHelper.accessor('dueDate', {
      id: 'dueDate',
      size: 100,
      header: () => (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Due
        </span>
      ),
      cell: ({ row }) => {
        const { text, className } = formatDueDate(row.original.dueDate);
        return <span className={cn('text-xs', className)}>{text}</span>;
      },
    }),
  ];
}
