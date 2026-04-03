import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  Bug,
  CircleCheck,
  Minus,
  Rocket,
  Zap,
} from 'lucide-react';

// ── Type icon mapping ───────────────────────────────────────────────────
// Keys match the string identifiers seeded by the backend.

export const TYPE_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'check-circle': CircleCheck,
  bug: Bug,
  'book-open': BookOpen,
  rocket: Rocket,
};

export function getTypeIcon(
  iconName: string | undefined | null,
): React.ComponentType<{ className?: string }> {
  if (!iconName) return CircleCheck;
  return TYPE_ICON_MAP[iconName] ?? CircleCheck;
}

// ── Priority config ─────────────────────────────────────────────────────

export type Priority = 'urgent' | 'high' | 'medium' | 'low' | 'none';

export const PRIORITY_CONFIG: Record<
  Priority,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }
> = {
  urgent: { label: 'Urgent', icon: AlertTriangle, color: 'text-red-500' },
  high: { label: 'High', icon: Zap, color: 'text-orange-500' },
  medium: { label: 'Medium', icon: Minus, color: 'text-yellow-500' },
  low: { label: 'Low', icon: ArrowDown, color: 'text-blue-500' },
  none: { label: 'None', icon: Minus, color: 'text-muted-foreground' },
};
