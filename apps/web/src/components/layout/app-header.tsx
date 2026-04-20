import { cn } from '@worknest/ui';
import { ChevronRight } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';

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
        'relative z-[5] flex h-[48px] shrink-0 items-center gap-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-0)] px-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-[13px] text-[color:var(--fg-3)]">
        {breadcrumbs?.map((crumb, index) => (
          <span key={crumb.label} className="inline-flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3 w-3 text-[color:var(--fg-4)]" />}
            {crumb.href ? (
              <a href={crumb.href} className="transition-colors hover:text-[color:var(--fg-1)]">
                {crumb.label}
              </a>
            ) : (
              <span>{crumb.label}</span>
            )}
          </span>
        ))}
        {breadcrumbs?.length ? <ChevronRight className="h-3 w-3 text-[color:var(--fg-4)]" /> : null}
        <span className="text-[13px] font-medium text-[color:var(--fg-1)]">{title}</span>
      </div>

      <div className="flex-1" />

      {actions && <div className="flex items-center gap-1">{actions}</div>}
      <ThemeToggle />
    </header>
  );
}
