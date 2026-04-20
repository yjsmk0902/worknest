import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-[6px] h-[18px] text-[10.5px] font-medium whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40',
  {
    variants: {
      variant: {
        default:
          'bg-[color:var(--bg-elev)] text-[color:var(--fg-mid)] border border-[color:var(--border-subtle)]',
        primary: 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive/15 text-destructive',
        outline: 'ring-1 ring-border text-foreground',
        status:
          'bg-[color:var(--bg-elev)] text-[color:var(--fg-mid)] border border-[color:var(--border-subtle)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
