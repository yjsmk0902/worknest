import * as React from 'react';
import { cn } from '../lib/utils';

export type PriorityKind = 'none' | 'low' | 'med' | 'high' | 'urgent';

export interface PriorityIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: PriorityKind;
}

const BAR_BASE = 'w-[2.5px] rounded-[1px]';

function bars(kind: PriorityKind) {
  switch (kind) {
    case 'low':
      return [
        'bg-[color:var(--p-low)]',
        'bg-[color:var(--border-strong)]',
        'bg-[color:var(--border-strong)]',
      ];
    case 'med':
      return [
        'bg-[color:var(--p-med)]',
        'bg-[color:var(--p-med)]',
        'bg-[color:var(--border-strong)]',
      ];
    case 'high':
      return ['bg-[color:var(--p-high)]', 'bg-[color:var(--p-high)]', 'bg-[color:var(--p-high)]'];
    default:
      return [
        'bg-[color:var(--border-strong)]',
        'bg-[color:var(--border-strong)]',
        'bg-[color:var(--border-strong)]',
      ];
  }
}

const PriorityIndicator = React.forwardRef<HTMLSpanElement, PriorityIndicatorProps>(
  ({ kind, className, ...props }, ref) => {
    if (kind === 'urgent') {
      return (
        <span
          ref={ref}
          className={cn(
            'inline-flex items-center justify-center w-3 h-3 rounded-[3px] bg-[color:var(--p-urgent)]',
            'font-mono text-[9px] font-bold',
            className,
          )}
          aria-label="Urgent"
          {...props}
        >
          <span className="text-[oklch(98%_0_0)] leading-none">!</span>
        </span>
      );
    }
    const [b1, b2, b3] = bars(kind);
    return (
      <span
        ref={ref}
        className={cn('inline-flex items-end gap-[1.5px] w-3 h-3', className)}
        aria-label={kind}
        {...props}
      >
        <span className={cn(BAR_BASE, 'h-[35%]', b1)} />
        <span className={cn(BAR_BASE, 'h-[65%]', b2)} />
        <span className={cn(BAR_BASE, 'h-full', b3)} />
      </span>
    );
  },
);
PriorityIndicator.displayName = 'PriorityIndicator';

export { PriorityIndicator };
