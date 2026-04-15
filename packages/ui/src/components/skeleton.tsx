import { cn } from '../lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className={cn('animate-pulse rounded-lg bg-muted/70', className)}
      {...props}
    />
  );
}

export { Skeleton };
