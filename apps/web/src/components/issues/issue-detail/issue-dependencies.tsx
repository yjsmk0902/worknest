import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IssueOutput, IssueRelationOutput, IssueRelationType } from '@worknest/shared';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toast,
} from '@worknest/ui';
import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type ListResponse, apiClient } from '../../../lib/api-client';

interface IssueDependenciesProps {
  issueId: string;
  projectId: string;
  projectPrefix: string;
}

const RELATION_OPTIONS: { type: IssueRelationType; label: string; hint: string }[] = [
  { type: 'blocks', label: '차단함', hint: '이 이슈가 다른 이슈를 막고 있음' },
  { type: 'relates_to', label: '관련', hint: '양방향 관련 이슈' },
];

const LABEL_MAP: Record<'blocks' | 'blocked_by' | 'relates_to', string> = {
  blocks: '차단함',
  blocked_by: '차단됨',
  relates_to: '관련',
};

const LABEL_COLOR: Record<'blocks' | 'blocked_by' | 'relates_to', string> = {
  blocks: 'text-rose-600 bg-rose-50 border-rose-200',
  blocked_by: 'text-amber-700 bg-amber-50 border-amber-200',
  relates_to: 'text-slate-700 bg-slate-50 border-slate-200',
};

export function IssueDependencies({
  issueId,
  projectId,
  projectPrefix,
}: IssueDependenciesProps) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<IssueRelationType>('blocks');
  const [search, setSearch] = useState('');

  const relationsQuery = useQuery<IssueRelationOutput[]>({
    queryKey: ['issues', issueId, 'relations'],
    queryFn: () =>
      apiClient.get<IssueRelationOutput[]>(`/projects/${projectId}/issues/${issueId}/relations`),
  });

  const issuesQuery = useQuery<ListResponse<IssueOutput>>({
    queryKey: ['projects', projectId, 'issues', 'quick-search', search],
    queryFn: () =>
      apiClient.getList<IssueOutput>(`/projects/${projectId}/issues`, {
        ...(search ? { title: search } : {}),
        limit: '10',
      }),
    enabled: pickerOpen,
    staleTime: 10 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: { targetIssueId: string; type: IssueRelationType }) =>
      apiClient.post(`/projects/${projectId}/issues/${issueId}/relations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', issueId, 'relations'] });
      setPickerOpen(false);
      setSearch('');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '의존성 추가에 실패했습니다.';
      toast(message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (relationId: string) =>
      apiClient.delete(`/projects/${projectId}/issues/${issueId}/relations/${relationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', issueId, 'relations'] });
    },
    onError: () => toast('의존성 제거에 실패했습니다.'),
  });

  const relations = relationsQuery.data ?? [];

  const grouped = useMemo(() => {
    const g: Record<'blocks' | 'blocked_by' | 'relates_to', IssueRelationOutput[]> = {
      blocks: [],
      blocked_by: [],
      relates_to: [],
    };
    for (const r of relations) g[r.label].push(r);
    return g;
  }, [relations]);

  const candidates = (issuesQuery.data?.data ?? []).filter(
    (i) => i.id !== issueId && !relations.some((r) => r.issue.id === i.id),
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">의존성</h3>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1">
              <Plus className="h-3.5 w-3.5" />
              추가
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-2" align="start">
            <div className="flex items-center gap-1 border-b pb-2">
              {RELATION_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setPickerType(opt.type)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    pickerType === opt.type
                      ? 'bg-[color:var(--bg-3)] text-foreground'
                      : 'text-muted-foreground hover:bg-[color:var(--bg-hover)]'
                  }`}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="py-2">
              <Input
                autoFocus
                placeholder="이슈 제목 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="max-h-[240px] space-y-[2px] overflow-y-auto">
              {candidates.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  {search ? '일치하는 이슈 없음' : '이슈를 검색하세요'}
                </div>
              ) : (
                candidates.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() =>
                      createMutation.mutate({ targetIssueId: i.id, type: pickerType })
                    }
                    disabled={createMutation.isPending}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[color:var(--bg-hover)]"
                  >
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {projectPrefix}-{i.sequenceId}
                    </span>
                    <span className="truncate">{i.title}</span>
                  </button>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {relations.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">등록된 의존성이 없습니다.</p>
      ) : (
        <div className="mt-2 space-y-1.5">
          {(['blocks', 'blocked_by', 'relates_to'] as const).map((label) => {
            const list = grouped[label];
            if (list.length === 0) return null;
            return (
              <div key={label} className="space-y-1">
                {list.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--panel)] px-2 py-1.5 text-sm"
                  >
                    <span
                      className={`shrink-0 rounded-full border px-2 py-[1px] text-[10px] ${LABEL_COLOR[label]}`}
                    >
                      {LABEL_MAP[label]}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {projectPrefix}-{r.issue.sequenceId}
                    </span>
                    <span className="flex-1 truncate">{r.issue.title}</span>
                    {r.issue.status && (
                      <span
                        className="shrink-0 rounded-sm px-1.5 py-[1px] text-[10px]"
                        style={{
                          backgroundColor: `${r.issue.status.color}22`,
                          color: r.issue.status.color,
                        }}
                      >
                        {r.issue.status.name}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => removeMutation.mutate(r.id)}
                      disabled={removeMutation.isPending}
                      aria-label="제거"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <Separator className="mt-4" />
    </div>
  );
}
