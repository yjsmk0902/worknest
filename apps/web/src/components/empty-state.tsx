import { Button } from '@worknest/ui';

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'ghost';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className={
        compact
          ? 'flex flex-col items-center justify-center py-8 gap-1.5'
          : 'flex flex-col items-center justify-center py-16 gap-2'
      }
    >
      <Icon
        aria-hidden="true"
        className={
          compact ? 'w-8 h-8 text-muted-foreground/40' : 'w-12 h-12 text-muted-foreground/50'
        }
      />
      <p
        className={
          compact
            ? 'text-sm font-medium text-muted-foreground mt-1'
            : 'text-lg font-medium text-foreground mt-2'
        }
      >
        {title}
      </p>
      {description && (
        <p
          className={
            compact
              ? 'text-xs text-muted-foreground/80 text-center max-w-[200px]'
              : 'text-sm text-muted-foreground text-center max-w-sm'
          }
        >
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={compact ? 'ghost' : (action.variant ?? 'outline')}
          size={compact ? 'sm' : 'default'}
          onClick={action.onClick}
          className={compact ? 'mt-2' : 'mt-4'}
        >
          {action.label}
        </Button>
      )}
      {secondaryAction && (
        <button
          type="button"
          onClick={secondaryAction.onClick}
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer mt-1"
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  );
}
