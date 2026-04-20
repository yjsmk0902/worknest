import * as React from 'react';
import { cn } from '../lib/utils';

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

const Kbd = React.forwardRef<HTMLElement, KbdProps>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      'inline-flex min-w-[16px] h-[17px] items-center justify-center px-1 rounded-[3px]',
      'font-mono text-[10.5px] font-medium text-[color:var(--fg-dim)]',
      'bg-[color:var(--bg-elev-2)] border border-[color:var(--border-subtle)]',
      'shadow-[0_1px_0_0_var(--border)]',
      className,
    )}
    {...props}
  />
));
Kbd.displayName = 'Kbd';

export { Kbd };
