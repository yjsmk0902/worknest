import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { SearchResultOutput } from '@worknest/shared';
import { Command as CommandPrimitive } from 'cmdk';
import {
  ArrowRight,
  CircleUser,
  FileText,
  Folder,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';

// ── Types ───────────────────────────────────────────────────────────────

interface RecentItem {
  type: 'issue' | 'page' | 'project';
  id: string;
  title: string;
  url: string;
}

interface CommandEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
}

// ── Constants ───────────────────────────────────────────────────────────

const RECENT_STORAGE_KEY = 'worknest:recent-search';
const MAX_RECENT_STORED = 20;
const MAX_RECENT_DISPLAYED = 5;
const DEBOUNCE_MS = 300;
const ISSUE_ID_PATTERN = /^[A-Z]{2,5}-\d+$/i;

// ── Recent items helpers ────────────────────────────────────────────────

function getRecentItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentItem[];
  } catch {
    return [];
  }
}

function addRecentItem(item: RecentItem): void {
  try {
    const items = getRecentItems().filter((i) => i.id !== item.id);
    items.unshift(item);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_STORED)));
  } catch {
    // localStorage unavailable
  }
}

// ── Hook: debounced search query ────────────────────────────────────────

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ── Component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const navigate = useNavigate();

  const params = useParams({ strict: false }) as {
    orgSlug?: string;
    wsSlug?: string;
  };
  const orgSlug = params.orgSlug ?? currentOrg?.slug ?? '';
  const wsSlug = params.wsSlug ?? currentWorkspace?.slug ?? '';
  const wsId = currentWorkspace?.id ?? '';

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine mode
  const isCommandMode = inputValue.startsWith('>');
  const searchText = isCommandMode ? '' : inputValue.trim();
  const commandFilter = isCommandMode ? inputValue.slice(1).trim() : '';

  // Debounce for API calls
  const debouncedSearch = useDebouncedValue(searchText, DEBOUNCE_MS);

  // Issue ID pattern detection
  const issueIdMatch = ISSUE_ID_PATTERN.test(searchText) ? searchText.toUpperCase() : null;

  // ── Search query ──────────────────────────────────────────────────────

  const shouldSearch = debouncedSearch.length > 0 && !isCommandMode && !!wsId;

  const searchQuery = useQuery<SearchResultOutput>({
    queryKey: ['command-palette-search', wsId, debouncedSearch],
    queryFn: () =>
      apiClient.get<SearchResultOutput>(`/workspaces/${wsId}/search`, { q: debouncedSearch }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  const isSearching = shouldSearch && searchQuery.isFetching;
  const categories = searchQuery.data?.categories;
  const hasResults =
    categories &&
    (categories.issues.length > 0 || categories.pages.length > 0 || categories.projects.length > 0);

  // ── Recent items ──────────────────────────────────────────────────────

  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    if (open) {
      setRecentItems(getRecentItems().slice(0, MAX_RECENT_DISPLAYED));
    }
  }, [open]);

  // ── Navigation helpers ────────────────────────────────────────────────

  const close = useCallback(() => {
    setOpen(false);
    setInputValue('');
  }, [setOpen]);

  const navigateTo = useCallback(
    (url: string, recent?: RecentItem) => {
      if (recent) {
        addRecentItem(recent);
      }
      close();
      navigate({ to: url });
    },
    [close, navigate],
  );

  // ── Commands ──────────────────────────────────────────────────────────

  const commands: CommandEntry[] = [
    {
      id: 'create-issue',
      label: '이슈 생성',
      icon: <Plus className="h-4 w-4 text-muted-foreground" />,
      keywords: ['이슈', '생성', 'issue', 'create', 'new'],
      action: () => {
        close();
        // Deferred to v1.0: Open a global issue-creation modal.
        // Requires a workspace-aware modal that can select a target project,
        // which depends on the global modal infrastructure planned for v1.0.
      },
    },
    {
      id: 'go-projects',
      label: '프로젝트 이동',
      icon: <Folder className="h-4 w-4 text-muted-foreground" />,
      keywords: ['프로젝트', '이동', 'project', 'go'],
      action: () => {
        navigateTo(`/${orgSlug}/${wsSlug}/projects`);
      },
    },
    {
      id: 'my-issues',
      label: '내 이슈',
      icon: <CircleUser className="h-4 w-4 text-muted-foreground" />,
      keywords: ['내', '이슈', 'my', 'issues'],
      action: () => {
        navigateTo(`/${orgSlug}/${wsSlug}/my/issues`);
      },
    },
    {
      id: 'settings',
      label: '설정',
      icon: <Settings className="h-4 w-4 text-muted-foreground" />,
      keywords: ['설정', 'settings'],
      action: () => {
        navigateTo(`/${orgSlug}/${wsSlug}/settings`);
      },
    },
    {
      id: 'logout',
      label: '로그아웃',
      icon: <LogOut className="h-4 w-4 text-muted-foreground" />,
      keywords: ['로그아웃', 'logout', 'signout'],
      action: () => {
        close();
        apiClient
          .post('/auth/logout')
          .catch(() => {})
          .finally(() => {
            window.location.href = '/login';
          });
      },
    },
  ];

  const filteredCommands = commandFilter
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(commandFilter.toLowerCase()) ||
          cmd.keywords.some((kw) => kw.toLowerCase().includes(commandFilter.toLowerCase())),
      )
    : commands;

  // ── Issue ID direct navigation ────────────────────────────────────────

  const handleIssueIdNavigate = useCallback((key: string) => {
    // Issue key (e.g., "PROJ-123") cannot be used directly as a URL because
    // routes expect project UUID, not the prefix. Instead, search for the
    // issue and let the user click the search result.
    setInputValue(key);
    // The debounced search will trigger automatically and show the matching issue
  }, []);

  // ── Render ────────────────────────────────────────────────────────────

  if (!open) return null;

  const showRecentItems = !isCommandMode && searchText.length === 0 && recentItems.length > 0;
  const showSearchResults = !isCommandMode && debouncedSearch.length > 0;
  const showEmptySearch = showSearchResults && !isSearching && !hasResults && !issueIdMatch;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 animate-in fade-in duration-150"
        onClick={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        role="presentation"
      />

      {/* Palette container */}
      <div className="fixed left-1/2 top-[20%] z-50 w-[640px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
        <CommandPrimitive
          label="글로벌 검색"
          shouldFilter={false}
          loop
          className="flex max-h-[400px] flex-col rounded-xl border border-border bg-popover shadow-lg"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
        >
          {/* Input area */}
          <div className="flex h-12 items-center gap-3 border-b border-border px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              ref={inputRef}
              value={inputValue}
              onValueChange={setInputValue}
              placeholder="검색하거나 명령어를 입력하세요..."
              className="flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Results area */}
          <CommandPrimitive.List className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {/* ── Command mode ───────────────────────────────── */}
            {isCommandMode &&
              (filteredCommands.length > 0 ? (
                <CommandPrimitive.Group
                  heading={
                    <span className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                      명령어
                    </span>
                  }
                >
                  {filteredCommands.map((cmd) => (
                    <CommandPrimitive.Item
                      key={cmd.id}
                      value={cmd.id}
                      onSelect={() => cmd.action()}
                      className="mx-2 flex h-10 cursor-pointer items-center gap-3 rounded-md px-4 transition-colors duration-150 aria-selected:bg-accent"
                    >
                      {cmd.icon}
                      <span className="text-sm text-foreground">{cmd.label}</span>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              ) : (
                <div className="flex flex-col items-center justify-center py-10">
                  <Search className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">일치하는 명령어가 없습니다</p>
                </div>
              ))}

            {/* ── Search mode ────────────────────────────────── */}
            {!isCommandMode && (
              <>
                {/* Issue ID direct navigation */}
                {issueIdMatch && (
                  <CommandPrimitive.Group>
                    <CommandPrimitive.Item
                      value={`goto-${issueIdMatch}`}
                      onSelect={() => handleIssueIdNavigate(issueIdMatch)}
                      className="mx-2 flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 transition-colors duration-150 aria-selected:bg-accent"
                    >
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {issueIdMatch}로 이동
                      </span>
                    </CommandPrimitive.Item>
                  </CommandPrimitive.Group>
                )}

                {/* Recent items (when input empty) */}
                {showRecentItems && (
                  <CommandPrimitive.Group
                    heading={
                      <span className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                        최근 항목
                      </span>
                    }
                  >
                    {recentItems.map((item) => (
                      <CommandPrimitive.Item
                        key={`recent-${item.id}`}
                        value={`recent-${item.id}`}
                        onSelect={() => navigateTo(item.url, item)}
                        className="mx-2 flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 transition-colors duration-150 aria-selected:bg-accent"
                      >
                        <RecentItemIcon type={item.type} />
                        <span className="flex-1 truncate text-sm text-foreground">
                          {item.title}
                        </span>
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                )}

                {/* Search results */}
                {showSearchResults && categories && (
                  <>
                    {/* Issues */}
                    {categories.issues.length > 0 && (
                      <CommandPrimitive.Group
                        heading={
                          <span className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                            이슈
                          </span>
                        }
                      >
                        {categories.issues.map((issue) => (
                          <CommandPrimitive.Item
                            key={issue.id}
                            value={`issue-${issue.id}`}
                            onSelect={() =>
                              navigateTo(issue.url, {
                                type: 'issue',
                                id: issue.id,
                                title: issue.title,
                                url: issue.url,
                              })
                            }
                            className="mx-2 flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 transition-colors duration-150 aria-selected:bg-accent"
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                            {issue.subtitle && (
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {issue.subtitle}
                              </span>
                            )}
                            <span className="ml-2 flex-1 truncate text-sm text-foreground">
                              {issue.title}
                            </span>
                          </CommandPrimitive.Item>
                        ))}
                      </CommandPrimitive.Group>
                    )}

                    {/* Wiki Pages */}
                    {categories.pages.length > 0 && (
                      <CommandPrimitive.Group
                        heading={
                          <span className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                            Wiki 페이지
                          </span>
                        }
                      >
                        {categories.pages.map((page) => (
                          <CommandPrimitive.Item
                            key={page.id}
                            value={`page-${page.id}`}
                            onSelect={() =>
                              navigateTo(page.url, {
                                type: 'page',
                                id: page.id,
                                title: page.title,
                                url: page.url,
                              })
                            }
                            className="mx-2 flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 transition-colors duration-150 aria-selected:bg-accent"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="ml-2 flex-1 truncate text-sm text-foreground">
                              {page.title}
                            </span>
                            {page.subtitle && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                {page.subtitle}
                              </span>
                            )}
                          </CommandPrimitive.Item>
                        ))}
                      </CommandPrimitive.Group>
                    )}

                    {/* Projects */}
                    {categories.projects.length > 0 && (
                      <CommandPrimitive.Group
                        heading={
                          <span className="px-4 py-1.5 text-xs font-medium text-muted-foreground">
                            프로젝트
                          </span>
                        }
                      >
                        {categories.projects.map((project) => (
                          <CommandPrimitive.Item
                            key={project.id}
                            value={`project-${project.id}`}
                            onSelect={() =>
                              navigateTo(project.url, {
                                type: 'project',
                                id: project.id,
                                title: project.title,
                                url: project.url,
                              })
                            }
                            className="mx-2 flex h-10 cursor-pointer items-center gap-2 rounded-md px-4 transition-colors duration-150 aria-selected:bg-accent"
                          >
                            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="ml-2 flex-1 truncate text-sm text-foreground">
                              {project.title}
                            </span>
                            {project.subtitle && (
                              <span className="ml-auto font-mono text-xs text-muted-foreground">
                                {project.subtitle}
                              </span>
                            )}
                          </CommandPrimitive.Item>
                        ))}
                      </CommandPrimitive.Group>
                    )}
                  </>
                )}

                {/* Empty state */}
                {showEmptySearch && (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">결과가 없습니다</p>
                  </div>
                )}
              </>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function RecentItemIcon({ type }: { type: RecentItem['type'] }) {
  switch (type) {
    case 'issue':
      return <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />;
    case 'page':
      return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
    case 'project':
      return <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}
