import { Link } from '@tanstack/react-router';
import type { CycleOutput, CycleProgressOutput } from '@worknest/shared';
import { Badge } from '@worknest/ui';
import { cn } from '@worknest/ui';
import { RefreshCw } from 'lucide-react';
import { EmptyState } from '../empty-state';

// ── Status Badge Config ────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className:
      'bg-[hsl(var(--status-backlog-bg))] text-[hsl(var(--status-backlog-text))] border-transparent',
  },
  active: {
    label: 'Active',
    className:
      'bg-[hsl(var(--status-unstarted-bg))] text-[hsl(var(--status-unstarted-text))] border-transparent',
  },
  completed: {
    label: 'Completed',
    className:
      'bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-text))] border-transparent',
  },
};

export function CycleStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <Badge className={cn('text-xs font-medium px-2 py-0.5 rounded-full', config.className)}>
      {config.label}
    </Badge>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────

interface CycleProgressBarProps {
  progress: CycleProgressOutput | undefined;
  height?: string;
}

export function CycleProgressBar({ progress, height = 'h-2' }: CycleProgressBarProps) {
  if (!progress || progress.total === 0) {
    return <div className={cn('w-full rounded-full bg-muted', height)} />;
  }

  const { total, byCategory } = progress;
  const completed = byCategory.completed ?? 0;
  const started = byCategory.started ?? 0;
  const unstarted = byCategory.unstarted ?? 0;
  const backlog = byCategory.backlog ?? 0;
  const cancelled = byCategory.cancelled ?? 0;

  const segments = [
    {
      count: completed,
      color: 'bg-[hsl(var(--status-completed-text))]',
    },
    {
      count: started,
      color: 'bg-[hsl(var(--status-started-text))]',
    },
    {
      count: unstarted,
      color: 'bg-[hsl(var(--status-unstarted-text))]',
    },
    {
      count: backlog,
      color: 'bg-[hsl(var(--status-backlog-text))]',
    },
    {
      count: cancelled,
      color: 'bg-[hsl(var(--status-cancelled-text))]',
    },
  ].filter((s) => s.count > 0);

  return (
    <div className={cn('flex w-full overflow-hidden rounded-full bg-muted', height)}>
      {segments.map((seg) => (
        <div
          key={seg.color}
          className={cn(seg.color, 'transition-all duration-300')}
          style={{
            width: `${(seg.count / total) * 100}%`,
            minWidth: seg.count > 0 ? '2px' : '0',
          }}
        />
      ))}
    </div>
  );
}

// ── Progress Text ──────────────────────────────────────────────────────

export function CycleProgressText({
  progress,
}: {
  progress: CycleProgressOutput | undefined;
}) {
  if (!progress) return null;

  const { total, byCategory } = progress;
  const completed = byCategory.completed ?? 0;
  const started = byCategory.started ?? 0;
  const unstarted = byCategory.unstarted ?? 0;

  return (
    <div className="flex items-center justify-between mt-2">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {completed > 0 && <span>완료 {completed}</span>}
        {completed > 0 && (started > 0 || unstarted > 0) && <span>&middot;</span>}
        {started > 0 && <span>진행 중 {started}</span>}
        {started > 0 && unstarted > 0 && <span>&middot;</span>}
        {unstarted > 0 && <span>미시작 {unstarted}</span>}
      </div>
      <span className="text-xs text-muted-foreground">총 {total}개</span>
    </div>
  );
}

// ── Date Formatting ────────────────────────────────────────────────────

export function formatCycleDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '';

  const format = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return sameYear ? `${month}/${day}` : `${d.getFullYear()}/${month}/${day}`;
  };

  if (startDate && endDate) return `${format(startDate)} - ${format(endDate)}`;
  if (startDate) return `${format(startDate)} -`;
  return `- ${format(endDate!)}`;
}

// ── Cycle Card ─────────────────────────────────────────────────────────

interface CycleCardProps {
  cycle: CycleOutput;
  progress?: CycleProgressOutput;
  orgSlug: string;
  wsSlug: string;
  projectId: string;
}

export function CycleCard({ cycle, progress, orgSlug, wsSlug, projectId }: CycleCardProps) {
  return (
    <Link
      to="/$orgSlug/$wsSlug/projects/$projectId/cycles/$cycleId"
      params={{ orgSlug, wsSlug, projectId, cycleId: cycle.id }}
      className="block rounded-lg border border-border bg-card p-4 mb-3 hover:border-border/80 hover:shadow-sm transition-all duration-150 cursor-pointer"
    >
      {/* Top row: name, status, date */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium flex-1 truncate">{cycle.name}</span>
        <CycleStatusBadge status={cycle.status} />
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {formatCycleDateRange(cycle.startDate, cycle.endDate)}
        </span>
      </div>

      {/* Description */}
      {cycle.description && (
        <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{cycle.description}</p>
      )}

      {/* Progress bar */}
      <div className="mt-3">
        <CycleProgressBar progress={progress} />
        <CycleProgressText progress={progress} />
      </div>
    </Link>
  );
}

// ── Cycle List ─────────────────────────────────────────────────────────

interface CycleListProps {
  cycles: CycleOutput[];
  progressMap: Record<string, CycleProgressOutput>;
  orgSlug: string;
  wsSlug: string;
  projectId: string;
}

export function CycleList({ cycles, progressMap, orgSlug, wsSlug, projectId }: CycleListProps) {
  return (
    <div>
      {cycles.map((cycle) => (
        <CycleCard
          key={cycle.id}
          cycle={cycle}
          progress={progressMap[cycle.id]}
          orgSlug={orgSlug}
          wsSlug={wsSlug}
          projectId={projectId}
        />
      ))}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────

interface CycleEmptyStateProps {
  onCreateClick: () => void;
}

export function CycleEmptyState({ onCreateClick }: CycleEmptyStateProps) {
  return (
    <EmptyState
      icon={RefreshCw}
      title="사이클이 없습니다"
      description="사이클을 만들어 스프린트를 관리하세요"
      action={{
        label: '사이클 만들기',
        onClick: onCreateClick,
      }}
    />
  );
}
