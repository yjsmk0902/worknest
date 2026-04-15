import { ImageUpload } from '@/components/settings/image-upload';
import { SettingsLayout } from '@/components/settings/settings-layout';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import { toast } from '@worknest/ui';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/settings/org/')({
  component: OrgSettingsGeneral,
});

interface OrgDetails {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
}

function OrgSettingsGeneral() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { orgId } = useWorkspaceContext();
  const queryClient = useQueryClient();

  const orgQuery = useQuery<OrgDetails>({
    queryKey: ['organizations', orgId],
    queryFn: () => apiClient.get(`/organizations/${orgId}`),
    enabled: !!orgId,
  });

  if (orgQuery.isLoading) {
    return (
      <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="org-general">
        <div className="max-w-[720px] space-y-8 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-16 rounded-lg" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </SettingsLayout>
    );
  }

  if (orgQuery.isError || !orgQuery.data) {
    return (
      <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="org-general">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">조직 설정을 불러올 수 없습니다.</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => orgQuery.refetch()}>
              다시 시도
            </Button>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="org-general">
      <OrgSettingsForm
        org={orgQuery.data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['organizations', orgId] })}
      />
    </SettingsLayout>
  );
}

function OrgSettingsForm({
  org,
  onSaved,
}: {
  org: OrgDetails;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    name: org.name,
  });

  const hasChanges = formData.name !== org.name;

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.patch(`/organizations/${org.id}`, data),
    onSuccess: () => {
      toast('조직 설정이 저장되었습니다.');
      onSaved();
    },
    onError: () => {
      toast('저장에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate(formData);
  }

  return (
    <div className="max-w-[720px] space-y-8 p-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">조직 설정</h2>
        <p className="text-sm text-muted-foreground">조직의 기본 정보를 관리합니다.</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>로고</Label>
        <ImageUpload
          currentUrl={org.logo}
          fallback={org.name}
          shape="logo"
          onUpdate={(url) => {
            apiClient.patch(`/organizations/${org.id}`, { logo: url }).then(() => {
              const store = useAuthStore.getState();
              if (store.currentOrg) {
                store.setCurrentOrg({ ...store.currentOrg, logo: url });
              }
              onSaved();
            });
          }}
        />
      </div>

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">조직 이름</Label>
          <Input
            id="org-name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-slug">조직 URL (slug)</Label>
          <Input id="org-slug" value={org.slug} disabled />
          <p className="text-xs text-muted-foreground">slug는 자동 생성되며 변경할 수 없습니다.</p>
        </div>

        <Button type="submit" disabled={!hasChanges || updateMutation.isPending}>
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
    </div>
  );
}
