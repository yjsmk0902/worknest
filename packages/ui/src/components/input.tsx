import * as React from 'react';
import { cn } from '../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-md border border-border bg-[color:var(--bg-elev)] px-[10px] py-0 text-[13px] text-foreground outline-none transition-all duration-150',
          'placeholder:text-[color:var(--fg-faint)]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          'focus-visible:border-[color:var(--accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error &&
            'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
