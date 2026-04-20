import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-[6px] whitespace-nowrap rounded-md font-medium tracking-[-0.005em] transition-[background-color,color,border-color,transform] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[14px] [&_svg]:shrink-0 border border-transparent',
  {
    variants: {
      variant: {
        default:
          'bg-[color:var(--accent-bg)] text-[color:var(--accent-fg)] hover:bg-[color:var(--accent-bg-hv)] active:translate-y-[0.5px]',
        destructive:
          'bg-transparent text-[color:var(--priority-urgent)] border-[color:var(--priority-urgent)]/40 hover:bg-[color:var(--priority-urgent)]/10',
        outline:
          'bg-[color:var(--bg-2)] text-[color:var(--fg-1)] border-[color:var(--border)] hover:bg-[color:var(--bg-3)] hover:border-[color:var(--border-strong)]',
        secondary:
          'bg-[color:var(--bg-2)] text-[color:var(--fg-1)] border-[color:var(--border)] hover:bg-[color:var(--bg-3)] hover:border-[color:var(--border-strong)]',
        ghost:
          'bg-transparent text-[color:var(--fg-2)] hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)]',
        link: 'text-[color:var(--accent-line)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 text-[13px]',
        sm: 'h-7 px-[10px] text-[12px]',
        lg: 'h-10 px-4 text-[14px]',
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
