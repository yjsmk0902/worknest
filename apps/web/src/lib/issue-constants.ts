import { BookOpen, Bug, CircleCheck, Rocket } from 'lucide-react';
import {
  PrioritySignalHigh,
  PrioritySignalLow,
  PrioritySignalMed,
  PrioritySignalNone,
  PriorityUrgent,
} from '../components/issues/priority-icons';

// ── Type icon mapping ───────────────────────────────────────────────────
// Keys match the string identifiers seeded by the backend.

export const TYPE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  urgent: { label: '긴급', icon: PriorityUrgent, color: '' },
  high: { label: '높음', icon: PrioritySignalHigh, color: '' },
  medium: { label: '보통', icon: PrioritySignalMed, color: '' },
  low: { label: '낮음', icon: PrioritySignalLow, color: '' },
  none: { label: '없음', icon: PrioritySignalNone, color: '' },
};
