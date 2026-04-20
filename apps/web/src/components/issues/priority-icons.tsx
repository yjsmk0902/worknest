import * as React from 'react';
import { cn } from '@worknest/ui';

/**
 * Priority icons that mirror the Claude Design reference:
 * - 3 ascending bars (2.5px wide, heights 35/65/100%)
 * - Lit bars progressively reflect the priority level
 * - Urgent uses a filled rounded square with a "!" glyph instead
 *
 * Each icon accepts the same `className` shape lucide-react exports so
 * it can slot into PRIORITY_CONFIG (which types the icon as
 * React.ComponentType<{ className?: string }>).
 */

type PriProps = { className?: string };

function PriBars({
  className,
  lit,
  color,
  muted,
}: {
  className?: string;
  lit: 0 | 1 | 2 | 3;
  color: string;
  muted: string;
}) {
  // 12px canvas — last bar 9px tall, mid 6px, first 3px (design spec)
  const bars: Array<{ x: number; y: number; h: number }> = [
    { x: 0, y: 9, h: 3 },
    { x: 4, y: 6, h: 6 },
    { x: 8, y: 3, h: 9 },
  ];
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className={cn('inline-block', className)}
      aria-hidden="true"
    >
      {bars.map((b, i) => (
        <rect
          key={`bar-${b.x}`}
          x={b.x}
          y={b.y}
          width={2}
          height={b.h}
          rx={1}
          fill={i < lit ? color : muted}
        />
      ))}
    </svg>
  );
}

export function PrioritySignalLow({ className }: PriProps) {
  return (
    <PriBars
      className={className}
      lit={1}
      color="var(--priority-low, #60a5fa)"
      muted="var(--fg-muted, #52525b)"
    />
  );
}

export function PrioritySignalMed({ className }: PriProps) {
  return (
    <PriBars
      className={className}
      lit={2}
      color="var(--priority-med, #eab308)"
      muted="var(--fg-muted, #52525b)"
    />
  );
}

export function PrioritySignalHigh({ className }: PriProps) {
  return (
    <PriBars
      className={className}
      lit={3}
      color="var(--priority-high, #f97316)"
      muted="var(--fg-muted, #52525b)"
    />
  );
}

export function PrioritySignalNone({ className }: PriProps) {
  return (
    <PriBars
      className={className}
      lit={0}
      color="var(--fg-muted, #52525b)"
      muted="var(--fg-muted, #52525b)"
    />
  );
}

export function PriorityUrgent({ className }: PriProps) {
  // Plain red exclamation mark, no background fill.
  // Two rects compose the "!" — vertical bar + dot underneath.
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      className={cn('inline-block', className)}
      aria-hidden="true"
    >
      <rect
        x={5}
        y={1.5}
        width={2}
        height={6}
        rx={1}
        fill="var(--priority-urgent, #e86e5c)"
      />
      <rect
        x={5}
        y={9}
        width={2}
        height={2}
        rx={1}
        fill="var(--priority-urgent, #e86e5c)"
      />
    </svg>
  );
}
