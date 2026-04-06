import { useState } from 'react';
import { ChevronRight, FileText, GripVertical } from 'lucide-react';
import { cn } from '@worknest/ui';
import type { WikiPageOutput } from '@worknest/shared';

interface PageTreeItemProps {
  page: WikiPageOutput;
  level: number;
  isSelected: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onClick: () => void;
  /** Props from dnd-kit for drag handle */
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
}

/**
 * Single tree node for a wiki page.
 *
 * Renders a chevron (if has children), page icon, and title.
 * Supports expand/collapse, selection highlight, and drag handle.
 */
export function PageTreeItem({
  page,
  level,
  isSelected,
  hasChildren,
  isExpanded,
  onToggle,
  onClick,
  dragHandleProps,
  isDragging,
}: PageTreeItemProps) {
  const indent = Math.min(level, 5) * 16 + 8;

  return (
    <div
      className={cn(
        'group flex h-8 items-center gap-1.5 rounded-sm cursor-pointer transition-colors',
        isSelected
          ? 'bg-accent font-medium'
          : 'hover:bg-accent/50',
        isDragging && 'opacity-85 shadow-lg scale-[1.02]',
      )}
      style={{ paddingLeft: `${indent}px` }}
      onClick={onClick}
      role="treeitem"
      aria-selected={isSelected}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      {/* Drag handle */}
      <div
        className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0"
        {...dragHandleProps}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* Expand/collapse chevron */}
      {hasChildren ? (
        <button
          type="button"
          className="shrink-0 flex items-center justify-center w-4 h-4"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'h-3 w-3 text-muted-foreground transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          />
        </button>
      ) : (
        <div className="w-4 shrink-0" />
      )}

      {/* Page icon */}
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Title */}
      <span className="text-sm truncate">{page.title}</span>
    </div>
  );
}
