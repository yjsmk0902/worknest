import { ImageUpload } from '@/components/settings/image-upload';
import { SettingsLayout } from '@/components/settings/settings-layout';
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

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/settings/profile')({
  component: ProfileSettings,
});

interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

function ProfileSettings() {
  const { orgSlug, wsSlug } = Route.useParams();
  const queryClient = useQueryClient();

  const profileQuery = useQuery<UserProfile>({
    queryKey: ['my', 'profile'],
    queryFn: () => apiClient.get('/my/profile'),
  });

  if (profileQuery.isLoading) {
    return (
      <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="profile">
        <div className="max-w-[720px] space-y-8 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </SettingsLayout>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="profile">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm text-muted-foreground">프로필을 불러올 수 없습니다.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => profileQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="profile">
      <ProfileForm
        profile={profileQuery.data}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['my', 'profile'] })}
      />
    </SettingsLayout>
  );
}

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: () => void;
}) {
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);
  const [formData, setFormData] = useState({
    name: profile.name,
  });

  const hasChanges = formData.name !== profile.name;

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => apiClient.patch<UserProfile>('/my/profile', data),
    onSuccess: (updated) => {
      toast('프로필이 저장되었습니다.');
      setCurrentUser({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatarUrl: updated.avatarUrl,
      });
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
        <h2 className="text-lg font-semibold text-foreground">프로필</h2>
        <p className="text-sm text-muted-foreground">계정 정보를 관리합니다.</p>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>아바타</Label>
        <ImageUpload
          currentUrl={profile.avatarUrl}
          fallback={profile.name}
          shape="avatar"
          onUpdate={(url) => {
            apiClient.patch('/my/profile', { avatarUrl: url }).then(() => {
              onSaved();
              setCurrentUser({
                id: profile.id,
                email: profile.email,
                name: profile.name,
                avatarUrl: url,
              });
            });
          }}
        />
      </div>

      <Separator />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="profile-name">이름</Label>
          <Input
            id="profile-name"
            value={formData.name}
            onChange={(e) => setFormData({ name: e.target.value })}
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="profile-email">이메일</Label>
          <Input id="profile-email" value={profile.email} disabled />
          <p className="text-xs text-muted-foreground">이메일은 변경할 수 없습니다.</p>
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
