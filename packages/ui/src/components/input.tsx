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
          'flex h-9 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--bg-2)] px-3 text-[14px] text-[color:var(--fg-1)] outline-none transition-[border-color,background,box-shadow] duration-150 tracking-[-0.005em]',
          'placeholder:text-[color:var(--fg-4)]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[color:var(--fg-1)]',
          'hover:border-[color:var(--border-strong)]',
          'focus-visible:border-[color:var(--accent-line)] focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error &&
            'border-[color:var(--priority-urgent)] focus-visible:border-[color:var(--priority-urgent)] focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--priority-urgent)_22%,transparent)]',
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
