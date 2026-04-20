import { Link } from '@tanstack/react-router';
import type { CycleOutput, CycleProgressOutput } from '@worknest/shared';
import { cn } from '@worknest/ui';
import { RefreshCw } from 'lucide-react';
import { EmptyState } from '../empty-state';

// ── Status Badge ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: {
    label: '예정',
    className: 'bg-[color:var(--bg-3)] text-[color:var(--fg-2)]',
  },
  active: {
    label: '진행 중',
    className:
      'bg-[color:var(--accent-soft)] text-[color:var(--accent-bg)] border border-[color:var(--accent-soft-border)]',
  },
  completed: {
    label: '완료',
    className: 'bg-[color:var(--bg-3)] text-[color:var(--fg-2)]',
  },
};

export function CycleStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft ?? { label: '', className: '' };
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-md px-[8px] text-[11.5px] font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────
// Single-color fill keyed to cycle status: draft=empty, active=amber,
// completed=green. Matches the design reference where the bar represents
// "percent done" rather than a stacked status breakdown.

interface CycleProgressBarProps {
  progress: CycleProgressOutput | undefined;
  status: string;
  height?: string;
}

export function CycleProgressBar({
  progress,
  status,
  height = 'h-[6px]',
}: CycleProgressBarProps) {
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? progress?.byCategory?.completed ?? 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const fillColor =
    status === 'completed'
      ? 'bg-[color:var(--status-done)]'
      : status === 'active'
        ? 'bg-[color:var(--status-progress)]'
        : 'bg-[color:var(--bg-4)]';

  // Draft cycles show the track only
  const width = status === 'completed' ? 100 : percent;

  return (
    <div className={cn('relative w-full overflow-hidden rounded-full bg-[color:var(--bg-3)]', height)}>
      <div
        className={cn('h-full transition-all duration-300', fillColor)}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function getCyclePercent(
  progress: CycleProgressOutput | undefined,
  status: string,
): number {
  if (status === 'completed') return 100;
  if (!progress || progress.total === 0) return 0;
  const completed = progress.completed ?? progress.byCategory?.completed ?? 0;
  return Math.round((completed / progress.total) * 100);
}

// ── Date Formatting ────────────────────────────────────────────────────

function formatDot(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function formatCycleDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return '';
  if (startDate && endDate) return `${formatDot(startDate)} — ${formatDot(endDate)}`;
  if (startDate) return `${formatDot(startDate)} —`;
  return `— ${formatDot(endDate!)}`;
}

function daysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.setHours(23, 59, 59, 999) - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
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
  const percent = getCyclePercent(progress, cycle.status);
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? progress?.byCategory?.completed ?? 0;
  const started = progress?.byCategory?.started ?? 0;
  const remaining = daysRemaining(cycle.endDate);
  const isActive = cycle.status === 'active';

  return (
    <Link
      to="/$orgSlug/$wsSlug/projects/$projectId/cycles/$cycleId"
      params={{ orgSlug, wsSlug, projectId, cycleId: cycle.id }}
      className="mb-3 block rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] p-5 transition-colors duration-150 hover:border-[color:var(--border)]"
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-[color:var(--fg-1)]">
              {cycle.name}
            </h3>
            {cycle.status !== 'draft' && <CycleStatusBadge status={cycle.status} />}
          </div>
          <p className="mt-1 text-[12px] text-[color:var(--fg-3)]">
            {formatCycleDateRange(cycle.startDate, cycle.endDate)}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[13px] text-[color:var(--fg-2)]">{percent}%</span>
      </div>

      {/* Description */}
      {cycle.description && (
        <p className="mt-2 text-[12.5px] text-[color:var(--fg-3)] line-clamp-1">
          {cycle.description}
        </p>
      )}

      {/* Progress bar */}
      <div className="mt-3">
        <CycleProgressBar progress={progress} status={cycle.status} />
      </div>

      {/* Stats (only for active cycles, when progress is loaded) */}
      {isActive && progress && (
        <div className="mt-4 grid grid-cols-4 gap-4 text-[color:var(--fg-1)]">
          <Stat label="범위" value={total} />
          <Stat label="완료" value={completed} />
          <Stat label="진행 중" value={started} />
          <Stat label="남은 일수" value={remaining ?? '—'} />
        </div>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-[color:var(--fg-4)]">{label}</span>
      <span className="mt-0.5 font-mono text-[18px] font-semibold text-[color:var(--fg-1)]">
        {value}
      </span>
    </div>
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
