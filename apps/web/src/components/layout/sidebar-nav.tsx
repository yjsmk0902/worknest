import { Link } from '@tanstack/react-router';
import { cn } from '@worknest/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@worknest/ui';
import { ChevronRight } from 'lucide-react';

export function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="group flex items-center justify-between px-[10px] pt-3 pb-[6px]">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-[color:var(--fg-faint)]">
        {children}
      </span>
      {action}
    </div>
  );
}

export interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  badge?: number;
  active?: boolean;
  expandable?: boolean;
}

export function NavItem({ icon, label, href, badge, expandable }: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        'relative flex h-7 items-center gap-[10px] rounded-md px-2 text-[13px] transition-colors',
        'text-[color:var(--fg-mid)] hover:bg-[color:var(--bg-hover)] hover:text-foreground',
        'data-[status=active]:bg-[color:var(--bg-sel)] data-[status=active]:text-foreground data-[status=active]:font-medium',
        'data-[status=active]:before:absolute data-[status=active]:before:left-[-6px] data-[status=active]:before:top-[6px] data-[status=active]:before:bottom-[6px] data-[status=active]:before:w-[2px] data-[status=active]:before:rounded-[2px] data-[status=active]:before:bg-[color:var(--accent)]',
      )}
    >
      <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center text-[color:var(--fg-dim)] [&>svg]:h-[15px] [&>svg]:w-[15px]">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto font-mono text-[11px] text-[color:var(--fg-faint)]">{badge}</span>
      )}
      {expandable && (
        <ChevronRight className="h-[14px] w-[14px] text-[color:var(--fg-faint)]" />
      )}
    </Link>
  );
}

export function CollapsedNavItem({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const cls =
    'flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors';

  const content = href ? (
    <Link to={href} className={cls}>
      {icon}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {icon}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
