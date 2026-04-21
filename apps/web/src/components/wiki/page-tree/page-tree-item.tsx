import type { WikiPageOutput } from '@worknest/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from '@worknest/ui';
import { ChevronRight, FileText, GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

interface PageTreeItemProps {
  page: WikiPageOutput;
  level: number;
  isSelected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  onAddChild?: () => void;
  onDelete?: () => void;
  /** Props from dnd-kit for drag handle */
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

export function PageTreeItem({
  page,
  level,
  isSelected,
  hasChildren,
  isExpanded,
  onToggle,
  onClick,
  onAddChild,
  onDelete,
  dragHandleProps,
  isDragging,
}: PageTreeItemProps) {
  const indent = Math.min(level, 5) * 14 + 8;

  return (
    <div
      className={cn(
        'group flex h-8 items-center gap-1 rounded-md text-[13px] cursor-pointer transition-colors',
        isSelected
          ? 'bg-[color:var(--bg-3)] text-[color:var(--fg-1)]'
          : 'text-[color:var(--fg-2)] hover:bg-[color:var(--bg-2)]',
        isDragging && 'opacity-70 shadow-lg',
      )}
      style={{ paddingLeft: `${indent}px`, paddingRight: '6px' }}
      onClick={onClick}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      {/* Drag handle */}
      <span
        className="-ml-1 flex w-3 shrink-0 cursor-grab items-center justify-center text-[color:var(--fg-4)] opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        {...dragHandleProps}
        aria-hidden="true"
      >
        <GripVertical className="h-3 w-3" />
      </span>

      {/* Expand/collapse chevron */}
      {hasChildren ? (
        <button
          type="button"
          className="grid h-4 w-4 shrink-0 place-items-center rounded text-[color:var(--fg-3)] transition-colors hover:text-[color:var(--fg-1)]"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={isExpanded ? '접기' : '펼치기'}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          />
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}

      {/* Page icon */}
      {page.icon ? (
        <span className="grid h-[16px] w-[16px] shrink-0 place-items-center text-[14px] leading-none">
          {page.icon}
        </span>
      ) : (
        <FileText
          className={cn(
            'h-[13px] w-[13px] shrink-0',
            isSelected ? 'text-[color:var(--fg-2)]' : 'text-[color:var(--fg-3)]',
          )}
        />
      )}

      {/* Title */}
      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          isSelected && 'font-medium',
          page.status === 'draft' && 'italic text-[color:var(--fg-3)]',
        )}
      >
        {page.title || '제목 없음'}
      </span>

      {page.status === 'draft' && (
        <span className="inline-flex h-[16px] shrink-0 items-center rounded bg-amber-500/15 px-[5px] font-mono text-[9.5px] font-medium text-amber-400">
          초안
        </span>
      )}

      {/* Hover: more menu (delete) */}
      {onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="grid h-5 w-5 shrink-0 place-items-center rounded text-[color:var(--fg-3)] opacity-0 transition-opacity hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)] group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="페이지 메뉴"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-36"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              onSelect={() => onDelete()}
              className="text-[color:var(--priority-urgent)] focus:text-[color:var(--priority-urgent)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Hover: add subpage */}
      {onAddChild && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-[color:var(--fg-3)] opacity-0 transition-opacity hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)] group-hover:opacity-100"
          aria-label="서브페이지 추가"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
