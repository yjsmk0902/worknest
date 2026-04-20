import { cn } from '@worknest/ui';

interface AppHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function AppHeader({ title, breadcrumbs, actions, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        'relative z-[5] flex h-[48px] shrink-0 items-center gap-1 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg)] px-[14px]',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-[6px] text-[13px] text-[color:var(--fg-mid)]">
        {breadcrumbs?.map((crumb, index) => (
          <span key={crumb.label} className="inline-flex items-center gap-[6px]">
            {index > 0 && <span className="text-[color:var(--fg-faint)]">/</span>}
            {crumb.href ? (
              <a href={crumb.href} className="transition-colors hover:text-foreground">
                {crumb.label}
              </a>
            ) : (
              <span>{crumb.label}</span>
            )}
          </span>
        ))}
        {breadcrumbs?.length ? (
          <span className="text-[color:var(--fg-faint)]">/</span>
        ) : null}
        <span className="text-[13px] font-medium text-foreground">{title}</span>
      </div>

      <div className="flex-1" />

      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </header>
  );
}
