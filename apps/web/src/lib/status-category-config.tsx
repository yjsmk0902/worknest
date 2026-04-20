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

/**
 * Display order for status categories in grouped list / board views.
 */
export const CATEGORY_ORDER: GroupCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'review',
  'completed',
  'cancelled',
];

export const CATEGORY_CONFIG: Record<GroupCategory, CategoryConfig> = {
  backlog: { key: 'backlog', label: '백로그', defaultOpen: true },
  unstarted: { key: 'unstarted', label: '할 일', defaultOpen: true },
  started: { key: 'started', label: '진행 중', defaultOpen: true },
  review: { key: 'review', label: '리뷰', defaultOpen: true },
  completed: { key: 'completed', label: '완료', defaultOpen: true },
  cancelled: { key: 'cancelled', label: '취소', defaultOpen: false },
};

/** Category color for group header icons (fallback when no status color available) */
export const CATEGORY_COLOR: Record<GroupCategory, string> = {
  started: 'var(--status-progress, #e8a838)',
  unstarted: 'var(--status-todo, #3b82f6)',
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
    // Ring + 1/3 pie wedge (120°) from 12 o'clock clockwise.
    // Wedge radius 6.75 matches the ring's outer edge (r=6, stroke=1.5) so
    // the filled slice merges with the ring — no donut boundary between
    // the two. End at 4 o'clock: (8 + 6.75*cos30°, 8 + 6.75*sin30°)
    // ≈ (13.846, 11.375).
    return (
      <svg
        viewBox="0 0 16 16"
        className="shrink-0"
        style={style}
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.5" />
        <path d="M 8 8 L 8 1.25 A 6.75 6.75 0 0 1 13.846 11.375 Z" fill={c} />
      </svg>
    );
  }
  if (category === 'review') {
    // Outer ring + solid center dot.
    return (
      <svg
        viewBox="0 0 16 16"
        className="shrink-0"
        style={style}
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" fill="none" stroke={c} strokeWidth="1.6" />
        <circle cx="8" cy="8" r="2.4" fill={c} />
      </svg>
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
