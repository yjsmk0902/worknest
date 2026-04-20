import * as React from 'react';
import { cn } from '../lib/utils';

export type StatusKind = 'backlog' | 'todo' | 'progress' | 'done' | 'cancel';

const KIND_RING: Record<StatusKind, string> = {
  backlog: 'border-[1.5px] border-dashed border-[color:var(--s-backlog)]',
  todo: 'border-[1.5px] border-solid border-[color:var(--s-todo)]',
  progress:
    'border-[1.5px] border-solid border-[color:var(--s-progress)] bg-[conic-gradient(var(--s-progress)_65%,transparent_0)] [mask:radial-gradient(circle,transparent_3px,#000_3.4px)] [-webkit-mask:radial-gradient(circle,transparent_3px,#000_3.4px)]',
  done: 'border-[1.5px] border-[color:var(--s-done)] bg-[color:var(--s-done)]',
  cancel: 'border-[1.5px] border-[color:var(--s-cancel)] bg-[color:var(--s-cancel)]',
};

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  kind: StatusKind;
  /** Optional text label rendered next to the dot */
  label?: React.ReactNode;
}

const StatusIndicator = React.forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ kind, label, className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-[6px] text-[12px] text-[color:var(--fg-mid)]',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'relative grid place-items-center w-3 h-3 rounded-full shrink-0',
          KIND_RING[kind],
        )}
      >
        {kind === 'done' && (
          <span className="w-[5px] h-[3px] border-l-[1.4px] border-b-[1.4px] border-[color:var(--bg)] rotate-[-45deg] translate-x-[0.4px] -translate-y-[0.5px]" />
        )}
        {kind === 'cancel' && (
          <span className="w-[6px] h-[1.4px] bg-[color:var(--bg)]" />
        )}
      </span>
      {label != null && <span>{label}</span>}
    </span>
  ),
);
StatusIndicator.displayName = 'StatusIndicator';

export { StatusIndicator };
