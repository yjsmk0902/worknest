import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Folder, ImageIcon, Smile, X } from 'lucide-react';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@worknest/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import { apiClient } from '@/lib/api-client';
import { ImageUpload } from '@/components/settings/image-upload';
import { ProjectSettingsLayout } from '@/components/projects/settings-layout';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { useProjectContext } from '@/contexts/project-context';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/projects/$projectId/settings/',
)({
  component: ProjectSettingsGeneral,
});

interface ProjectDetails {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  prefix: string;
  iconUrl: string | null;
  issueCounter: number;
  createdAt: string;
  updatedAt: string;
}

function ProjectSettingsGeneral() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const { projectName } = useProjectContext();
  const queryClient = useQueryClient();

  const projectQuery = useQuery<ProjectDetails>({
    queryKey: ['projects', projectId],
    queryFn: () =>
      apiClient.get(`/workspaces/${wsId}/projects/${projectId}`),
  });

  if (projectQuery.isLoading) {
    return (
      <ProjectSettingsLayout
        orgSlug={orgSlug}
        wsSlug={wsSlug}
        projectId={projectId}
        projectName={projectName}
        activeTab="general"
      >
        <div className="max-w-[720px] space-y-8 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-4">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </ProjectSettingsLayout>
    );
  }

  if (projectQuery.isError) {
    return (
      <ProjectSettingsLayout
        orgSlug={orgSlug}
        wsSlug={wsSlug}
        projectId={projectId}
        projectName={projectName}
        activeTab="general"
      >
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">
              설정을 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => projectQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </ProjectSettingsLayout>
    );
  }

  return (
    <ProjectSettingsLayout
      orgSlug={orgSlug}
      wsSlug={wsSlug}
      projectId={projectId}
      projectName={projectName}
      activeTab="general"
    >
      <GeneralSettingsForm
        project={projectQuery.data!}
        orgSlug={orgSlug}
        wsSlug={wsSlug}
        onSaved={() => {
          queryClient.invalidateQueries({
            queryKey: ['projects', projectId],
          });
          queryClient.invalidateQueries({
            queryKey: ['workspaces', wsId, 'projects'],
          });
          queryClient.invalidateQueries({
            queryKey: ['workspaces', wsId, 'projects', 'sidebar'],
          });
        }}
      />
    </ProjectSettingsLayout>
  );
}

function GeneralSettingsForm({
  project,
  orgSlug,
  wsSlug,
  onSaved,
}: {
  project: ProjectDetails;
  orgSlug: string;
  wsSlug: string;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const { wsId } = useWorkspaceContext();
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description ?? '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const hasChanges =
    formData.name !== project.name ||
    formData.description !== (project.description ?? '');

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.patch(
        `/workspaces/${project.workspaceId}/projects/${project.id}`,
        data,
      ),
    onSuccess: () => {
      toast('설정이 저장되었습니다.');
      onSaved();
    },
    onError: () => {
      toast('저장에 실패했습니다. 다시 시도해주세요.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiClient.delete(
        `/workspaces/${project.workspaceId}/projects/${project.id}`,
      ),
    onSuccess: () => {
      toast('프로젝트가 삭제되었습니다.');
      navigate({
        to: '/$orgSlug/$wsSlug/projects',
        params: { orgSlug, wsSlug },
      });
    },
    onError: () => {
      toast('삭제에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate(formData);
  }

  return (
    <div className="max-w-[720px] space-y-8 p-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          프로젝트 설정
        </h2>
        <p className="text-sm text-muted-foreground">
          프로젝트의 기본 정보를 관리합니다.
        </p>
      </div>

      <Separator />

      {/* Icon */}
      <ProjectIconEditor
        project={project}
        onUpdate={(iconUrl) => {
          apiClient
            .patch(`/workspaces/${project.workspaceId}/projects/${project.id}`, { iconUrl })
            .then(() => {
              toast('아이콘이 변경되었습니다.');
              onSaved();
            })
            .catch(() => toast('아이콘 변경에 실패했습니다.'));
        }}
      />

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="proj-name">프로젝트 이름</Label>
          <Input
            id="proj-name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="proj-prefix">접두사</Label>
          <Input
            id="proj-prefix"
            value={project.prefix}
            disabled
            className="cursor-not-allowed bg-muted font-mono"
          />
          <p className="text-xs text-muted-foreground">
            접두사는 생성 후 변경할 수 없습니다.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="proj-desc">설명</Label>
          <textarea
            id="proj-desc"
            rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            disabled={updateMutation.isPending}
          />
        </div>

        <Button
          type="submit"
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            '변경사항 저장'
          )}
        </Button>
      </form>

      <Separator />

      {/* Danger zone */}
      <div>
        <h2 className="text-lg font-semibold text-destructive">위험 영역</h2>
      </div>

      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              프로젝트 삭제
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              이 프로젝트와 모든 이슈, 사이클, 뷰가 삭제됩니다.
            </p>
            <p className="text-sm text-muted-foreground">
              이 작업은 30일 이내에 복구할 수 있습니다.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            프로젝트 삭제
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>프로젝트 삭제</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              정말 &quot;{project.name}&quot; 프로젝트를 삭제하시겠습니까?
              모든 이슈, 사이클, 뷰가 삭제됩니다. 30일 이내에 복구할 수
              있습니다.
            </p>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                확인을 위해 프로젝트 이름을 입력해주세요:
              </Label>
              <Input
                id="delete-confirm"
                placeholder={project.name}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                disabled={deleteMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={deleteMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleteConfirmText !== project.name ||
                deleteMutation.isPending
              }
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────

function isImageUrl(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith('/api/') || value.startsWith('http');
}

// ── Emoji grid ─────────────────────────────────────────────────────────

const PROJECT_EMOJIS = [
  '📁', '📂', '📋', '📌', '📎', '📝', '📊', '📈',
  '🎯', '🚀', '⚡', '🔥', '💡', '🛠️', '🔧', '⚙️',
  '🎨', '🖌️', '🎬', '🎮', '🎵', '📱', '💻', '🖥️',
  '🌐', '🔒', '🔑', '📡', '🗂️', '📦', '🏗️', '🏠',
  '🧪', '🔬', '📚', '✏️', '🗓️', '⏰', '💰', '🛒',
  '❤️', '💙', '💚', '💛', '💜', '🧡', '🤍', '🖤',
  '⭐', '🌟', '✨', '🌈', '🍀', '🌸', '🌻', '🌙',
];

// ── Project Icon Editor ────────────────────────────────────────────────

function ProjectIconEditor({
  project,
  onUpdate,
}: {
  project: ProjectDetails;
  onUpdate: (iconUrl: string | null) => void;
}) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [imageMode, setImageMode] = useState(false);

  const currentIcon = project.iconUrl;
  const isImage = isImageUrl(currentIcon);

  return (
    <div className="space-y-2">
      <Label>아이콘</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted overflow-hidden">
          {isImage && currentIcon ? (
            <img src={currentIcon} alt={project.name} className="h-12 w-12 object-cover" />
          ) : currentIcon ? (
            <span className="text-2xl">{currentIcon}</span>
          ) : (
            <Folder className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2">
          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <Smile className="mr-1.5 h-3.5 w-3.5" />
                이모지
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[296px] p-2">
              <div className="grid grid-cols-8 gap-0.5">
                {PROJECT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onUpdate(emoji);
                      setEmojiOpen(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" onClick={() => setImageMode(true)}>
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
            이미지
          </Button>

          {currentIcon && (
            <Button variant="ghost" size="sm" onClick={() => onUpdate(null)}>
              <X className="mr-1.5 h-3.5 w-3.5" />
              제거
            </Button>
          )}
        </div>
      </div>

      {imageMode && (
        <div className="pt-2">
          <ImageUpload
            currentUrl={isImage ? currentIcon : null}
            fallback={project.name}
            shape="logo"
            onUpdate={(url) => {
              onUpdate(url);
              setImageMode(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
