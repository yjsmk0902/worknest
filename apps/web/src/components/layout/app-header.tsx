import { cn } from '@worknest/ui';

interface AppHeaderProps {
  title: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  title,
  breadcrumbs,
  actions,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-6',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {index > 0 && (
                  <span className="text-muted-foreground">/</span>
                )}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {crumb.label}
                  </span>
                )}
              </span>
            ))}
            <span className="text-muted-foreground">/</span>
          </nav>
        )}
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
