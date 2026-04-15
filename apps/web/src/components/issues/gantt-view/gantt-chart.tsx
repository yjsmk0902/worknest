import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  startOfDay,
  addDays,
  differenceInDays,
  format,
  isToday,
  isWeekend,
  startOfWeek,
  endOfMonth,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  subDays,
  getWeek,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarRange, Calendar } from 'lucide-react';
import { Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@worknest/ui';
import { cn } from '@worknest/ui';
import type { IssueOutput } from '@worknest/shared';

// ── Types ──────────────────────────────────────────────────────────────

type ZoomLevel = 'day' | 'week' | 'month';

interface GanttIssue extends IssueOutput {
  _startDate: Date | null;
  _dueDate: Date | null;
}

interface GanttChartProps {
  issues: IssueOutput[];
  projectPrefix: string;
  onIssueClick?: (issueId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const ROW_HEIGHT = 40;
const LEFT_PANEL_WIDTH = 360;
const HEADER_HEIGHT = 56;

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 40, label: '일' },
  week: { dayWidth: 16, label: '주' },
  month: { dayWidth: 5, label: '월' },
};

// Timeline range: years before/after today per zoom level
const RANGE_YEARS: Record<ZoomLevel, number> = {
  day: 1,
  week: 3,
  month: 5,
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
  none: '#94a3b8',
};

// ── Helpers ────────────────────────────────────────────────────────────

function getStatusColor(status?: { color: string } | null): string {
  return status?.color ?? '#94a3b8';
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

// ── Component ──────────────────────────────────────────────────────────

export function GanttChart({
  issues,
  projectPrefix,
  onIssueClick,
}: GanttChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [containerWidth, setContainerWidth] = useState(0);

  // Track right-panel width
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Process issues with parsed dates
  const ganttIssues = useMemo<GanttIssue[]>(() => {
    return issues.map((issue) => ({
      ...issue,
      _startDate: parseDate(issue.startDate),
      _dueDate: parseDate(issue.dueDate),
    }));
  }, [issues]);

  // Fixed timeline range: today ± RANGE_YEARS per zoom level
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    const years = RANGE_YEARS[zoom];
    const start = startOfWeek(addDays(today, -years * 365), { locale: ko });
    const end = addDays(today, years * 365);
    const days = differenceInDays(end, start) + 1;
    return { timelineStart: start, timelineEnd: end, totalDays: days };
  }, [zoom]);

  // dayWidth: day=fixed, week/month=fit comfortable viewport window
  const dayWidth = useMemo(() => {
    const base = ZOOM_CONFIG[zoom].dayWidth;
    if (zoom === 'day' || !containerWidth) return base;
    // Week: ~10 weeks visible, Month: ~1 year visible
    const visibleDays = zoom === 'week' ? 10 * 7 : 365;
    return Math.max(base, containerWidth / visibleDays);
  }, [zoom, containerWidth]);

  const timelineWidth = totalDays * dayWidth;

  // Scroll to today on mount and zoom change
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const today = startOfDay(new Date());
    const offset = differenceInDays(today, timelineStart) * dayWidth;
    container.scrollLeft = Math.max(0, offset - container.clientWidth / 3);
  }, [zoom, timelineStart, dayWidth]);

  const isSyncing = useRef(false);

  // Sync vertical scroll between left and right panels
  const handleTimelineScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const leftPanel = leftPanelRef.current;
    if (!container || !leftPanel || isSyncing.current) return;
    isSyncing.current = true;
    leftPanel.scrollTop = container.scrollTop;
    isSyncing.current = false;
  }, []);

  const handleLeftPanelScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    const leftPanel = leftPanelRef.current;
    if (!container || !leftPanel || isSyncing.current) return;
    isSyncing.current = true;
    container.scrollTop = leftPanel.scrollTop;
    isSyncing.current = false;
  }, []);

  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const today = startOfDay(new Date());
    const offset = differenceInDays(today, timelineStart) * dayWidth;
    container.scrollTo({
      left: Math.max(0, offset - container.clientWidth / 3),
      behavior: 'smooth',
    });
  }, [timelineStart, dayWidth]);

  // Calculate bar position for an issue
  // Returns { left, width, milestone } — milestone is set when only one date exists
  const getBarStyle = useCallback(
    (issue: GanttIssue): { left: number; width: number; milestone?: 'start' | 'due' } | null => {
      const hasStart = !!issue._startDate;
      const hasDue = !!issue._dueDate;
      if (!hasStart && !hasDue) return null;

      // Only one date → milestone marker
      if (hasStart && !hasDue) {
        const left = differenceInDays(issue._startDate!, timelineStart) * dayWidth;
        return { left, width: dayWidth, milestone: 'start' };
      }
      if (!hasStart && hasDue) {
        const left = differenceInDays(issue._dueDate!, timelineStart) * dayWidth;
        return { left, width: dayWidth, milestone: 'due' };
      }

      // Both dates → full bar
      const start = issue._startDate!;
      const end = issue._dueDate!;
      const effectiveStart = start <= end ? start : end;
      const effectiveEnd = start <= end ? end : start;

      const leftOffset = differenceInDays(effectiveStart, timelineStart) * dayWidth;
      const width = Math.max(
        (differenceInDays(effectiveEnd, effectiveStart) + 1) * dayWidth,
        dayWidth,
      );

      return { left: leftOffset, width };
    },
    [timelineStart, dayWidth],
  );

  const todayOffset = useMemo(() => {
    const today = startOfDay(new Date());
    return differenceInDays(today, timelineStart) * dayWidth;
  }, [timelineStart, dayWidth]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setZoom(level)}
              className={cn(
                'h-7 rounded-sm px-3 text-xs font-medium transition-all',
                zoom === level
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {ZOOM_CONFIG[level].label}
            </button>
          ))}
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={scrollToToday}
                className="gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs">오늘</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>오늘 날짜로 스크롤</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" />
          <span>
            {ganttIssues.filter((i) => i._startDate || i._dueDate).length}/
            {ganttIssues.length}개 이슈에 날짜 설정됨
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: issue list */}
        <div
          ref={leftPanelRef}
          className="shrink-0 border-r border-border overflow-y-auto overflow-x-hidden"
          style={{ width: LEFT_PANEL_WIDTH }}
          onScroll={handleLeftPanelScroll}
        >
          {/* Left header */}
          <div
            className="sticky top-0 z-10 flex items-end border-b border-border bg-muted/50 px-3"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="pb-2 text-xs font-medium text-muted-foreground">
              이슈
            </span>
          </div>

          {/* Issue rows */}
          {ganttIssues.map((issue) => (
            <button
              key={issue.id}
              type="button"
              onClick={() => onIssueClick?.(issue.id)}
              className="flex w-full items-center gap-2 border-b border-border/50 px-3 text-left transition-colors hover:bg-muted/30"
              style={{ height: ROW_HEIGHT }}
            >
              {/* Priority dot */}
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: PRIORITY_COLORS[issue.priority] ?? '#94a3b8',
                }}
              />

              {/* Status dot */}
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                style={{
                  backgroundColor: getStatusColor(issue.status),
                }}
              />

              {/* Issue key */}
              <span className="shrink-0 text-[11px] font-mono text-muted-foreground">
                {projectPrefix}-{issue.sequenceId}
              </span>

              {/* Title */}
              <span className="truncate text-sm text-foreground">
                {issue.title}
              </span>

              {/* Assignee avatar */}
              {issue.assignees && issue.assignees.length > 0 && (
                <div className="ml-auto flex shrink-0 -space-x-1">
                  {issue.assignees.slice(0, 2).map((a) => (
                    <div
                      key={a.userId}
                      className="relative flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-1 ring-background"
                    >
                      {a.user.name.charAt(0).toUpperCase()}
                      {a.user.avatarUrl && (
                        <img
                          src={a.user.avatarUrl}
                          alt=""
                          className="absolute inset-0 h-5 w-5 rounded-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </button>
          ))}

          {ganttIssues.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              표시할 이슈가 없습니다
            </div>
          )}
        </div>

        {/* Right panel: timeline */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto"
          onScroll={handleTimelineScroll}
        >
          <div style={{ width: timelineWidth, minHeight: '100%' }}>
            {/* Timeline header */}
            <TimelineHeader
              timelineStart={timelineStart}
              timelineEnd={timelineEnd}
              dayWidth={dayWidth}
              zoom={zoom}
            />

            {/* Timeline body */}
            <div className="relative">
              {/* Background grid */}
              <TimelineGrid
                timelineStart={timelineStart}
                totalDays={totalDays}
                dayWidth={dayWidth}
                rowCount={ganttIssues.length}
                zoom={zoom}
              />

              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 z-20 w-px bg-primary"
                style={{ left: todayOffset + dayWidth / 2 }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-b-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  오늘
                </div>
              </div>

              {/* Issue bars */}
              {ganttIssues.map((issue) => {
                const barStyle = getBarStyle(issue);
                const hasDates = issue._startDate || issue._dueDate;

                return (
                  <div
                    key={issue.id}
                    className="relative border-b border-border/30"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {barStyle && barStyle.milestone ? (
                      /* ── Milestone: single date ── */
                      <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onIssueClick?.(issue.id)}
                            className="absolute top-1/2 z-10 -translate-y-1/2 cursor-pointer flex items-center gap-1.5"
                            style={{ left: barStyle.left }}
                          >
                            {/* Diamond marker */}
                            <span
                              className="h-3.5 w-3.5 shrink-0 rotate-45 rounded-sm shadow-sm transition-transform hover:scale-125"
                              style={{
                                backgroundColor: getStatusColor(issue.status),
                              }}
                            />
                            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                              {projectPrefix}-{issue.sequenceId}{' '}
                              <span className="text-muted-foreground/60">
                                ({barStyle.milestone === 'start' ? '시작일' : '마감일'})
                              </span>
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px]">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">
                              {projectPrefix}-{issue.sequenceId} {issue.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {barStyle.milestone === 'start'
                                ? `시작: ${format(issue._startDate!, 'yyyy.MM.dd')} · 마감일 미설정`
                                : `마감: ${format(issue._dueDate!, 'yyyy.MM.dd')} · 시작일 미설정`}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      </TooltipProvider>
                    ) : barStyle ? (
                      /* ── Full bar: both dates ── */
                      <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onIssueClick?.(issue.id)}
                            className="group absolute top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-md transition-all hover:brightness-110 hover:shadow-md"
                            style={{
                              left: barStyle.left,
                              width: barStyle.width,
                              height: ROW_HEIGHT - 12,
                              backgroundColor: getStatusColor(issue.status),
                              opacity: 0.85,
                            }}
                          >
                            {barStyle.width > 60 && (
                              <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white drop-shadow-sm overflow-hidden">
                                <span className="truncate">
                                  <span className="opacity-70 mr-1">{projectPrefix}-{issue.sequenceId}</span>
                                  {issue.title}
                                </span>
                              </span>
                            )}
                            <span className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-ew-resize" />
                            <span className="absolute right-0 top-0 bottom-0 w-1 rounded-r-md bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-ew-resize" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[280px]">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">
                              {projectPrefix}-{issue.sequenceId} {issue.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {issue._startDate && (
                                <span>
                                  시작: {format(issue._startDate, 'yyyy.MM.dd')}
                                </span>
                              )}
                              {issue._dueDate && (
                                <span>
                                  마감: {format(issue._dueDate, 'yyyy.MM.dd')}
                                </span>
                              )}
                            </div>
                            {issue.status && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor: issue.status.color,
                                  }}
                                />
                                <span>{issue.status.name}</span>
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      </TooltipProvider>
                    ) : (
                      !hasDates && (
                        <div
                          className="absolute top-1/2 z-10 -translate-y-1/2 flex items-center text-xs text-muted-foreground/40 italic"
                          style={{
                            left: todayOffset + dayWidth,
                          }}
                        >
                          날짜 미설정
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Timeline Header ────────────────────────────────────────────────────

function TimelineHeader({
  timelineStart,
  timelineEnd,
  dayWidth,
  zoom,
}: {
  timelineStart: Date;
  timelineEnd: Date;
  dayWidth: number;
  zoom: ZoomLevel;
}) {
  const months = useMemo(
    () =>
      eachMonthOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineStart, timelineEnd],
  );

  const weeks = useMemo(
    () =>
      eachWeekOfInterval(
        { start: timelineStart, end: timelineEnd },
        { locale: ko },
      ),
    [timelineStart, timelineEnd],
  );

  const days = useMemo(
    () =>
      eachDayOfInterval({ start: timelineStart, end: timelineEnd }),
    [timelineStart, timelineEnd],
  );

  return (
    <div
      className="sticky top-0 z-30 border-b border-border bg-muted/50 backdrop-blur-sm"
      style={{ height: HEADER_HEIGHT }}
    >
      {/* Top row: months */}
      <div className={cn('flex border-b border-border', zoom === 'month' ? 'h-full' : 'h-7')}>
        {months.map((month) => {
          const monthStart = month < timelineStart ? timelineStart : month;
          const monthEnd = endOfMonth(month) > timelineEnd ? timelineEnd : endOfMonth(month);
          const daysInView = differenceInDays(monthEnd, monthStart) + 1;
          const left = differenceInDays(monthStart, timelineStart) * dayWidth;
          const width = daysInView * dayWidth;

          return (
            <div
              key={month.toISOString()}
              className="absolute flex items-center border-r border-border px-2 text-xs font-medium text-muted-foreground"
              style={{ left, width, height: zoom === 'month' ? HEADER_HEIGHT : 28 }}
            >
              {format(month, 'yyyy년 M월', { locale: ko })}
            </div>
          );
        })}
      </div>

      {/* Bottom row: days or weeks (hidden in month zoom) */}
      {zoom !== 'month' && (
        <div className="relative flex" style={{ height: HEADER_HEIGHT - 28 }}>
          {zoom === 'day' &&
            days.map((day) => {
              const left = differenceInDays(day, timelineStart) * dayWidth;
              const today = isToday(day);
              const weekend = isWeekend(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'absolute flex items-center justify-center border-r border-border/40 text-[10px]',
                    today
                      ? 'font-bold text-primary'
                      : weekend
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground',
                  )}
                  style={{ left, width: dayWidth, height: HEADER_HEIGHT - 28 }}
                >
                  {format(day, 'd')}
                </div>
              );
            })}

          {zoom === 'week' &&
            weeks.map((week) => {
              const left = differenceInDays(week, timelineStart) * dayWidth;
              const remainingDays = differenceInDays(timelineEnd, week) + 1;
              const width = Math.min(7, remainingDays) * dayWidth;
              const weekNum = getWeek(week, { locale: ko });

              return (
                <div
                  key={week.toISOString()}
                  className="absolute flex items-center justify-center border-r border-border/60 text-[10px] text-muted-foreground"
                  style={{ left, width, height: HEADER_HEIGHT - 28 }}
                >
                  {format(week, 'M/d')} ({weekNum}주)
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ── Timeline Grid ──────────────────────────────────────────────────────

function TimelineGrid({
  timelineStart,
  totalDays,
  dayWidth,
  rowCount,
  zoom,
}: {
  timelineStart: Date;
  totalDays: number;
  dayWidth: number;
  rowCount: number;
  zoom: ZoomLevel;
}) {
  const totalHeight = Math.max(rowCount * ROW_HEIGHT, 400);

  const lines = useMemo(() => {
    const result: { left: number; isWeekend: boolean; isWeekBorder: boolean; isMonthBorder: boolean }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const day = addDays(timelineStart, i);
      const left = i * dayWidth;
      const weekend = isWeekend(day);
      const isMonday = day.getDay() === 1;
      const isFirstOfMonth = day.getDate() === 1;
      result.push({ left, isWeekend: weekend, isWeekBorder: isMonday, isMonthBorder: isFirstOfMonth });
    }
    return result;
  }, [timelineStart, totalDays, dayWidth]);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ height: totalHeight }}>
      {lines.map(({ left, isWeekend: weekend, isWeekBorder, isMonthBorder }, i) => (
        <div key={i}>
          {/* Weekend background (day zoom only) */}
          {zoom === 'day' && weekend && (
            <div
              className="absolute top-0 bg-muted/30"
              style={{ left, width: dayWidth, height: totalHeight }}
            />
          )}
          {/* Day zoom: week borders */}
          {zoom === 'day' && isWeekBorder && (
            <div
              className="absolute top-0 w-px bg-border/40"
              style={{ left, height: totalHeight }}
            />
          )}
          {/* Week zoom: week borders */}
          {zoom === 'week' && isWeekBorder && (
            <div
              className="absolute top-0 w-px bg-border/30"
              style={{ left, height: totalHeight }}
            />
          )}
          {/* Month zoom: month borders only */}
          {zoom === 'month' && isMonthBorder && (
            <div
              className="absolute top-0 w-px bg-border/40"
              style={{ left, height: totalHeight }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
