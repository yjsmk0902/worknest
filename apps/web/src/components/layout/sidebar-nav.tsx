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
    <div className="flex items-center justify-between mt-5 mb-1 px-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-foreground/40">
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

export function NavItem({ icon, label, href, badge, active, expandable }: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        'flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
        'text-sidebar-foreground hover:bg-sidebar-accent',
        'data-[status=active]:bg-primary/10 data-[status=active]:text-primary data-[status=active]:font-semibold',
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
      {expandable && <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/30" />}
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
