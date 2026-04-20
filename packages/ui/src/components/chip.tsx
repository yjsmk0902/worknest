import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/utils';

const chipVariants = cva(
  'inline-flex items-center gap-[6px] h-[26px] px-[9px] rounded-md text-[12px] border transition-all duration-150 ease-out cursor-pointer',
  {
    variants: {
      variant: {
        ghost:
          'border-transparent text-[color:var(--fg-mid)] hover:bg-[color:var(--bg-hover)] hover:text-foreground',
        filled:
          'bg-[color:var(--bg-elev)] border-[color:var(--border-subtle)] text-foreground hover:border-[color:var(--border)]',
        accent:
          'bg-[color:var(--accent-soft)] text-[color:var(--accent)] border-transparent',
      },
    },
    defaultVariants: {
      variant: 'ghost',
    },
  },
);

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {}

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, variant, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(chipVariants({ variant }), className)}
      {...props}
    />
  ),
);
Chip.displayName = 'Chip';

export { Chip, chipVariants };
