import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import { apiClient } from '../../../../lib/api-client';
import { SettingsLayout } from '../../../../components/settings/settings-layout';
import { useWorkspaceContext } from '../../../../contexts/workspace-context';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/settings/',
)({
  component: WorkspaceSettingsGeneral,
});

interface WorkspaceDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
}

function WorkspaceSettingsGeneral() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const queryClient = useQueryClient();

  const wsQuery = useQuery<WorkspaceDetails>({
    queryKey: ['workspace', wsId],
    queryFn: () => apiClient.get(`/workspaces/${wsId}`),
  });

  if (wsQuery.isLoading) {
    return (
      <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="general">
        <div className="max-w-[720px] space-y-8 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </SettingsLayout>
    );
  }

  if (wsQuery.isError) {
    return (
      <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="general">
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
              onClick={() => wsQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="general">
      <GeneralSettingsForm
        workspace={wsQuery.data!}
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ['workspace', wsId] })
        }
      />
    </SettingsLayout>
  );
}

function GeneralSettingsForm({
  workspace,
  onSaved,
}: {
  workspace: WorkspaceDetails;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description ?? '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const hasChanges =
    formData.name !== workspace.name ||
    formData.slug !== workspace.slug ||
    formData.description !== (workspace.description ?? '');

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.patch(`/workspaces/${workspace.id}`, data),
    onSuccess: () => {
      toast('설정이 저장되었습니다.');
      onSaved();
    },
    onError: () => {
      toast('저장에 실패했습니다. 다시 시도해주세요.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/workspaces/${workspace.id}`),
    onSuccess: () => {
      toast('워크스페이스가 삭제되었습니다.');
      // Navigate to orgs page after deletion
      window.location.href = '/orgs';
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
      {/* General section */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          워크스페이스 설정
        </h2>
        <p className="text-sm text-muted-foreground">
          워크스페이스의 기본 정보를 관리합니다.
        </p>
      </div>

      <Separator />

      {/* Logo upload placeholder */}
      <div className="space-y-2">
        <Label>로고</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
            {workspace.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              변경
            </Button>
            <Button variant="ghost" size="sm">
              제거
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ws-name">워크스페이스 이름</Label>
          <Input
            id="ws-name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ws-slug">워크스페이스 URL (slug)</Label>
          <Input
            id="ws-slug"
            value={formData.slug}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, slug: e.target.value }))
            }
            disabled={updateMutation.isPending}
          />
          {formData.slug && (
            <p className="text-xs text-muted-foreground">
              worknest.app/.../{formData.slug}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ws-desc">설명</Label>
          <textarea
            id="ws-desc"
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
              워크스페이스 삭제
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              이 워크스페이스와 모든 데이터가 삭제됩니다.
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
            워크스페이스 삭제
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>워크스페이스 삭제</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              정말 &quot;{workspace.name}&quot; 워크스페이스를
              삭제하시겠습니까? 모든 프로젝트, 이슈, Wiki 페이지가
              삭제됩니다. 30일 이내에 복구할 수 있습니다.
            </p>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm">
                확인을 위해 워크스페이스 이름을 입력해주세요:
              </Label>
              <Input
                id="delete-confirm"
                placeholder={workspace.name}
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
                deleteConfirmText !== workspace.name ||
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
