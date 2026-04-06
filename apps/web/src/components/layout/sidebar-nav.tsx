import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@worknest/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@worknest/ui';

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
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

export function NavItem({
  icon,
  label,
  href,
  badge,
  active,
  expandable,
}: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md px-3 text-sm transition-colors hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent font-medium',
      )}
    >
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
          {badge}
        </span>
      )}
      {expandable && (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </Link>
  );
}

export function CollapsedNavItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-sidebar-accent"
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
