import type { StatusCategory } from '@worknest/shared';

/**
 * Status category display config for list/board grouping.
 * Adds a visual "review" slot even though the backend doesn't emit it
 * today (the section renders empty until statuses with category='review'
 * exist). Matches the Claude Design reference.
 */

export type GroupCategory = StatusCategory | 'review';

export interface CategoryConfig {
  key: GroupCategory;
  label: string;
  /** Default expand state when no user preference */
  defaultOpen: boolean;
}

export const CATEGORY_ORDER: GroupCategory[] = [
  'started',
  'unstarted',
  'review',
  'backlog',
  'completed',
  'cancelled',
];

export const CATEGORY_CONFIG: Record<GroupCategory, CategoryConfig> = {
  started: { key: 'started', label: '진행 중', defaultOpen: true },
  unstarted: { key: 'unstarted', label: '할 일', defaultOpen: true },
  review: { key: 'review', label: '리뷰', defaultOpen: true },
  backlog: { key: 'backlog', label: '백로그', defaultOpen: false },
  completed: { key: 'completed', label: '완료', defaultOpen: false },
  cancelled: { key: 'cancelled', label: '취소', defaultOpen: false },
};

/** Category color for group header icons (fallback when no status color available) */
export const CATEGORY_COLOR: Record<GroupCategory, string> = {
  started: 'var(--status-progress, #e8a838)',
  unstarted: 'var(--status-todo, #8b8f99)',
  review: 'var(--status-review, #a88be3)',
  backlog: 'var(--status-backlog, #6b7280)',
  completed: 'var(--status-done, #4caf7b)',
  cancelled: 'var(--status-cancel, #6b6b73)',
};

/**
 * Category-shape icon used in group headers and pill triggers.
 * Filled disc with glyph (done/cancel) | ring with conic pie (started)
 * | dashed ring (backlog) | solid ring (others).
 */
export function CategoryGlyph({
  category,
  color,
  size = 12,
}: {
  category: GroupCategory | undefined;
  color?: string;
  size?: number;
}) {
  const c = color || (category ? CATEGORY_COLOR[category] : '#94a3b8');
  const px = `${size}px`;
  const style: React.CSSProperties = { width: px, height: px };

  if (category === 'completed') {
    return (
      <span
        className="relative grid shrink-0 place-items-center rounded-full"
        style={{ ...style, backgroundColor: c }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 12 12"
          className="h-[60%] w-[60%]"
          fill="none"
          stroke="var(--bg-0, #000)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 6.5 L5 9 L9.5 3.5" />
        </svg>
      </span>
    );
  }
  if (category === 'cancelled') {
    return (
      <span
        className="relative grid shrink-0 place-items-center rounded-full"
        style={{ ...style, backgroundColor: c }}
        aria-hidden="true"
      >
        <span
          className="h-[1.5px] w-[55%]"
          style={{ backgroundColor: 'var(--bg-0)' }}
        />
      </span>
    );
  }
  if (category === 'started') {
    return (
      <span
        className="relative shrink-0 rounded-full"
        aria-hidden="true"
        style={{
          ...style,
          border: `1.5px solid ${c}`,
          background: `conic-gradient(${c} 60%, transparent 0)`,
          WebkitMask: 'radial-gradient(circle, transparent 25%, #000 28%)',
          mask: 'radial-gradient(circle, transparent 25%, #000 28%)',
        }}
      />
    );
  }
  if (category === 'review') {
    // Purple-ish filled ring with center dot
    return (
      <span
        className="relative grid shrink-0 place-items-center rounded-full"
        style={{ ...style, border: `1.5px solid ${c}` }}
        aria-hidden="true"
      >
        <span
          className="h-[40%] w-[40%] rounded-full"
          style={{ backgroundColor: c }}
        />
      </span>
    );
  }
  if (category === 'backlog') {
    return (
      <span
        className="shrink-0 rounded-full"
        style={{ ...style, border: `1.5px dashed ${c}` }}
        aria-hidden="true"
      />
    );
  }
  // unstarted / default
  return (
    <span
      className="shrink-0 rounded-full"
      style={{ ...style, border: `1.5px solid ${c}` }}
      aria-hidden="true"
    />
  );
}
