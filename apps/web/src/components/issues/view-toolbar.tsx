import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
} from '@worknest/ui';
import { ArrowUpDown, Columns3, GanttChart, List } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { SavedViewsDropdown } from '../views/saved-views-dropdown';
import { FilterPopover } from './filter-builder/filter-popover';
import { type ActiveFilter, useIssueFilters } from './filter-builder/use-issue-filters';

// ── Sort option types ──────────────────────────────────────────────────

type SortField = 'created_at' | 'updated_at' | 'priority' | 'due_date' | 'manual';
type SortOrder = 'asc' | 'desc';

interface SortOption {
  field: SortField;
  label: string;
  defaultOrder: SortOrder;
}

const SORT_OPTIONS: SortOption[] = [
  { field: 'created_at', label: '생성일', defaultOrder: 'desc' },
  { field: 'updated_at', label: '수정일', defaultOrder: 'desc' },
  { field: 'priority', label: '우선순위', defaultOrder: 'desc' },
  { field: 'due_date', label: '마감일', defaultOrder: 'asc' },
  { field: 'manual', label: '수동', defaultOrder: 'asc' },
];

const ORDER_OPTIONS: { value: SortOrder; label: string; icon: string }[] = [
  { value: 'asc', label: '오름차순', icon: '↑' },
  { value: 'desc', label: '내림차순', icon: '↓' },
];

// ── View type ──────────────────────────────────────────────────────────

type ViewType = 'list' | 'board' | 'gantt';

interface ViewTab {
  type: ViewType;
  label: string;
  icon: typeof List;
  routeSuffix: string;
}

const VIEW_TABS: ViewTab[] = [
  { type: 'list', label: '리스트', icon: List, routeSuffix: '/issues' },
  { type: 'board', label: '보드', icon: Columns3, routeSuffix: '/board' },
  { type: 'gantt', label: '간트', icon: GanttChart, routeSuffix: '/gantt' },
];

// ── Props ──────────────────────────────────────────────────────────────

interface ViewToolbarProps {
  totalCount?: number;
}

// ── Component ──────────────────────────────────────────────────────────

export function ViewToolbar({ totalCount }: ViewToolbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const search = useSearch({ strict: false }) as Record<string, unknown>;

  const { filters, addFilter } = useIssueFilters();

  // Determine current view from the URL path
  const activeView = useMemo<ViewType>(() => {
    if (location.pathname.includes('/board')) return 'board';
    if (location.pathname.includes('/gantt')) return 'gantt';
    return 'list';
  }, [location.pathname]);

  // Current sort state from search params
  const currentSort = useMemo<SortField>(() => {
    const s = search.sort as string | undefined;
    if (s && SORT_OPTIONS.some((opt) => opt.field === s)) return s as SortField;
    return 'created_at';
  }, [search.sort]);

  const currentOrder = useMemo<SortOrder>(() => {
    const o = search.order as string | undefined;
    if (o === 'asc' || o === 'desc') return o;
    // Use the default order for the current sort field
    return SORT_OPTIONS.find((opt) => opt.field === currentSort)?.defaultOrder ?? 'desc';
  }, [search.order, currentSort]);

  const currentSortLabel = useMemo(
    () => SORT_OPTIONS.find((opt) => opt.field === currentSort)?.label ?? '생성일',
    [currentSort],
  );

  // Navigate between views while preserving search params
  const handleViewChange = useCallback(
    (view: ViewType) => {
      if (view === activeView) return;

      const tab = VIEW_TABS.find((t) => t.type === view);
      if (!tab) return;

      // Build the target path by replacing the current view segment
      const pathParts = location.pathname.split('/');
      const viewSegments = ['issues', 'board', 'gantt'];
      const replaceIndex = pathParts.findIndex((p) => viewSegments.includes(p));

      if (replaceIndex !== -1) {
        const segmentMap: Record<ViewType, string> = {
          list: 'issues',
          board: 'board',
          gantt: 'gantt',
        };
        pathParts[replaceIndex] = segmentMap[view];
        const newPath = pathParts.join('/');
        navigate({
          to: newPath,
          search: search as Record<string, string>,
        });
      }
    },
    [activeView, location.pathname, navigate, search],
  );

  // Update sort field
  const handleSortChange = useCallback(
    (field: string) => {
      const sortField = field as SortField;
      const defaultOrder =
        SORT_OPTIONS.find((opt) => opt.field === sortField)?.defaultOrder ?? 'desc';
      navigate({
        search: {
          ...search,
          sort: sortField,
          order: defaultOrder,
        } as Record<string, string>,
        replace: true,
      });
    },
    [navigate, search],
  );

  // Update sort order
  const handleOrderChange = useCallback(
    (order: string) => {
      navigate({
        search: {
          ...search,
          order,
        } as Record<string, string>,
        replace: true,
      });
    },
    [navigate, search],
  );

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background px-4"
      role="toolbar"
      aria-label="이슈 뷰 제어"
    >
      {/* View Tabs */}
      <div className="inline-flex rounded-md bg-muted p-0.5" role="tablist" aria-label="뷰 전환">
        {VIEW_TABS.map((tab) => {
          const isActive = tab.type === activeView;
          const Icon = tab.icon;
          return (
            <button
              key={tab.type}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="issue-view"
              className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-3 text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-background font-medium text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleViewChange(tab.type)}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <Separator orientation="vertical" className="h-4" />

      {/* Filter trigger */}
      <FilterPopover
        filterCount={filters.length}
        onApply={(filter: ActiveFilter) => addFilter(filter)}
      />

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" aria-haspopup="menu">
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">정렬: {currentSortLabel}</span>
            <span className="xl:hidden">정렬</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            정렬 기준
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={currentSort} onValueChange={handleSortChange}>
            {SORT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.field} value={option.field}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            정렬 방향
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={currentOrder} onValueChange={handleOrderChange}>
            {ORDER_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.icon} {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Separator */}
      <Separator orientation="vertical" className="h-4" />

      {/* Saved Views */}
      <SavedViewsDropdown currentViewType={activeView} />

      {/* Issue Count */}
      {totalCount !== undefined && (
        <span className="ml-auto hidden text-sm text-muted-foreground xl:inline" aria-live="polite">
          {totalCount}개 이슈
        </span>
      )}
    </div>
  );
}
