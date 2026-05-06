import { ProjectSettingsLayout } from '@/components/projects/settings-layout';
import { useProjectContext } from '@/contexts/project-context';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { IssueTemplateOutput, Priority } from '@worknest/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label as FormLabel,
  Input,
  Skeleton,
  toast,
} from '@worknest/ui';
import { AlertTriangle, FileText, Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/settings/templates',
)({
  component: ProjectSettingsTemplates,
});

interface IssueTypeRow {
  id: string;
  name: string;
}

interface LabelRow {
  id: string;
  name: string;
  color: string;
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'urgent', label: '긴급' },
  { value: 'high', label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low', label: '낮음' },
  { value: 'none', label: '없음' },
];

function ProjectSettingsTemplates() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { projectName } = useProjectContext();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<IssueTemplateOutput | null>(null);
  const [deleting, setDeleting] = useState<IssueTemplateOutput | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['projects', projectId, 'issue-templates'],
    queryFn: () =>
      apiClient.get<{ data: IssueTemplateOutput[] }>(`/projects/${projectId}/issue-templates`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/projects/${projectId}/issue-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issue-templates'] });
      toast('템플릿이 삭제되었습니다.');
      setDeleting(null);
    },
    onError: () => {
      toast('템플릿 삭제에 실패했습니다.');
    },
  });

  const templates = templatesQuery.data?.data ?? [];

  return (
    <ProjectSettingsLayout
      orgSlug={orgSlug}
      wsSlug={wsSlug}
      projectId={projectId}
      projectName={projectName}
      activeTab="templates"
    >
      <div className="max-w-[720px] space-y-8 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">이슈 템플릿</h2>
            <p className="text-sm text-muted-foreground">
              이슈 생성 시 자주 쓰는 필드를 미리 채워둘 템플릿을 관리합니다.
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            템플릿 추가
          </Button>
        </div>

        {templatesQuery.isLoading && (
          <div className="space-y-2">
            {['a', 'b', 'c'].map((slot) => (
              <div
                key={slot}
                className="flex items-center gap-3 rounded-md border border-border px-4 py-3"
              >
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        )}

        {templatesQuery.isError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive">템플릿 목록을 불러올 수 없습니다.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => templatesQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {templatesQuery.isSuccess && templates.length === 0 && (
          <div className="rounded-md border border-border bg-muted/50 p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-base font-medium text-foreground">템플릿이 없습니다</p>
            <p className="mt-1 text-sm text-muted-foreground">
              자주 쓰는 이슈 패턴을 템플릿으로 만들어보세요
            </p>
            <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              템플릿 추가
            </Button>
          </div>
        )}

        {templatesQuery.isSuccess && templates.length > 0 && (
          <div className="rounded-md border border-border">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center border-b border-border px-4 last:border-b-0 hover:bg-accent/50"
                style={{ minHeight: '52px' }}
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">{t.name}</span>
                    {t.isDefault && (
                      <span className="rounded bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                        기본
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <span className="line-clamp-1 pl-5 text-xs text-muted-foreground">
                      {t.description}
                    </span>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="작업 메뉴">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditing(t)}>수정</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeleting(t)}
                    >
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      <TemplateFormModal
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issue-templates'] })
        }
      />

      <TemplateFormModal
        projectId={projectId}
        template={editing ?? undefined}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issue-templates'] })
        }
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>템플릿 삭제</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              &quot;{deleting?.name}&quot; 템플릿을 삭제하시겠습니까?
            </p>
            <p className="text-sm text-muted-foreground">이미 생성된 이슈에는 영향이 없습니다.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={deleteMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectSettingsLayout>
  );
}

// ── Template form (create / edit) ──────────────────────────────────────

function tipTapBodyToText(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  // Simple linearization: walk doc/paragraph/heading nodes and join text
  const paragraphs: string[] = [];
  type Node = { type?: string; text?: string; content?: Node[] };
  const visit = (node: Node, isBlockRoot: boolean) => {
    if (!node) return;
    if (node.type === 'text' && node.text) {
      paragraphs[paragraphs.length - 1] += node.text;
      return;
    }
    if (isBlockRoot) paragraphs.push('');
    if (Array.isArray(node.content)) {
      for (const child of node.content) visit(child, isChildBlock(child));
    }
  };
  const isChildBlock = (n: Node) =>
    n.type === 'paragraph' || n.type === 'heading' || n.type === 'listItem';
  visit(body as Node, false);
  return paragraphs.filter((p) => p.length > 0).join('\n\n');
}

function textToTipTapBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const paragraphs = trimmed.split(/\n{2,}/);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      content: p ? [{ type: 'text', text: p }] : [],
    })),
  };
}

function TemplateFormModal({
  projectId,
  template,
  open,
  onOpenChange,
  onSuccess,
}: {
  projectId: string;
  template?: IssueTemplateOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const isEdit = !!template;

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [titleTemplate, setTitleTemplate] = useState(template?.titleTemplate ?? '');
  const [priority, setPriority] = useState<Priority>(template?.priority ?? 'none');
  const [typeId, setTypeId] = useState<string | null>(template?.typeId ?? null);
  const [labelIds, setLabelIds] = useState<string[]>(template?.labelIds ?? []);
  const [bodyText, setBodyText] = useState(tipTapBodyToText(template?.body));
  const [bodyEdited, setBodyEdited] = useState(false);

  const [prevId, setPrevId] = useState(template?.id);
  if (template?.id !== prevId) {
    setPrevId(template?.id);
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setTitleTemplate(template?.titleTemplate ?? '');
    setPriority(template?.priority ?? 'none');
    setTypeId(template?.typeId ?? null);
    setLabelIds(template?.labelIds ?? []);
    setBodyText(tipTapBodyToText(template?.body));
    setBodyEdited(false);
  }

  const typesQuery = useQuery<IssueTypeRow[]>({
    queryKey: ['projects', projectId, 'types'],
    queryFn: () => apiClient.get<IssueTypeRow[]>(`/projects/${projectId}/types`),
    enabled: open,
  });
  const labelsQuery = useQuery<LabelRow[]>({
    queryKey: ['projects', projectId, 'labels'],
    queryFn: () => apiClient.get<LabelRow[]>(`/projects/${projectId}/labels`),
    enabled: open,
  });

  const types = typesQuery.data ?? [];
  const labels = labelsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post(`/projects/${projectId}/issue-templates`, data),
    onSuccess: () => {
      toast('템플릿이 생성되었습니다.');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast('템플릿 생성에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.patch(`/projects/${projectId}/issue-templates/${template?.id}`, data),
    onSuccess: () => {
      toast('템플릿이 수정되었습니다.');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast('템플릿 수정에 실패했습니다.'),
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const base: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      titleTemplate: titleTemplate,
      priority,
      typeId: typeId ?? null,
      labelIds,
    };
    // Only send body when user actually edited the textarea
    if (bodyEdited || !isEdit) {
      base.body = textToTipTapBody(bodyText);
    }

    if (isEdit) {
      updateMutation.mutate(base);
    } else {
      createMutation.mutate(base);
    }
  }

  const hasRichBody =
    !!template?.body && tipTapBodyToText(template.body) !== bodyText && !bodyEdited;

  function toggleLabel(id: string) {
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? '템플릿 수정' : '템플릿 추가'}</DialogTitle>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <FormLabel htmlFor="tpl-name">이름</FormLabel>
            <Input
              id="tpl-name"
              placeholder="예: 버그 리포트"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="tpl-desc">설명</FormLabel>
            <Input
              id="tpl-desc"
              placeholder="템플릿 선택 시 표시되는 한 줄 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="tpl-title">제목 프리픽스</FormLabel>
            <Input
              id="tpl-title"
              placeholder="예: [버그] (선택)"
              value={titleTemplate}
              onChange={(e) => setTitleTemplate(e.target.value)}
              maxLength={200}
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <FormLabel>우선순위</FormLabel>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={isLoading}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <FormLabel>타입</FormLabel>
              <select
                value={typeId ?? ''}
                onChange={(e) => setTypeId(e.target.value || null)}
                disabled={isLoading || typesQuery.isLoading}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">없음</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <FormLabel>라벨</FormLabel>
            {labels.length === 0 && (
              <p className="text-xs text-muted-foreground">이 프로젝트에 라벨이 없습니다.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const active = labelIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <FormLabel htmlFor="tpl-body">본문 (선택)</FormLabel>
            <textarea
              id="tpl-body"
              value={bodyText}
              onChange={(e) => {
                setBodyText(e.target.value);
                setBodyEdited(true);
              }}
              placeholder="이슈 설명에 미리 채울 내용. 빈 줄로 문단 구분."
              disabled={isLoading}
              rows={6}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {hasRichBody && (
              <p className="text-[11px] text-muted-foreground">
                ⚠ 이 템플릿은 서식이 있는 본문을 포함합니다. 텍스트로 편집하면 서식이 단순 문단으로
                변환됩니다.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
