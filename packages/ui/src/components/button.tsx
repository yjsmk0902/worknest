import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[14px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_1px_0_0_oklch(100%_0_0_/_0.15)_inset,0_1px_2px_oklch(0%_0_0_/_0.2)] hover:brightness-[1.08] active:translate-y-[0.5px]',
        destructive:
          'bg-destructive text-[oklch(98%_0_0)] shadow-[0_1px_0_0_oklch(100%_0_0_/_0.15)_inset,0_1px_2px_oklch(0%_0_0_/_0.2)] hover:brightness-[1.08] active:translate-y-[0.5px]',
        outline:
          'border border-border bg-secondary text-foreground hover:border-[color:var(--border-strong)]',
        secondary:
          'bg-[color:var(--bg-elev)] text-foreground border border-[color:var(--border-subtle)] hover:bg-[color:var(--bg-hover)]',
        ghost:
          'text-[color:var(--fg-mid)] hover:bg-[color:var(--bg-hover)] hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 text-[12.5px]',
        sm: 'h-[22px] px-2 text-[11.5px]',
        lg: 'h-10 px-6 text-sm',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
