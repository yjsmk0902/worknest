import { SettingsLayout } from '@/components/settings/settings-layout';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Avatar } from '@worknest/ui';
import { Badge } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import { Loader2, MoreHorizontal, Search, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { OrgInviteModal } from '@/components/settings/org-invite-modal';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/settings/org/members')({
  component: OrgSettingsMembers,
});

interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  admin: 'secondary',
  member: 'outline',
};

function OrgSettingsMembers() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { orgId } = useWorkspaceContext();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['organizations', orgId, 'members'],
    queryFn: () => apiClient.getList<OrgMember>(`/organizations/${orgId}/members`),
    enabled: !!orgId,
  });

  const members = membersQuery.data?.data ?? [];
  const filtered = search
    ? members.filter(
        (m) =>
          m.user.name.toLowerCase().includes(search.toLowerCase()) ||
          m.user.email.toLowerCase().includes(search.toLowerCase()),
      )
    : members;

  return (
    <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="org-members">
      <div className="max-w-[720px] space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">조직 멤버</h2>
          <p className="text-sm text-muted-foreground">조직에 소속된 멤버를 관리합니다.</p>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="이름 또는 이메일로 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setInviteOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            멤버 초대
          </Button>
        </div>

        {orgId && (
          <OrgInviteModal orgId={orgId} open={inviteOpen} onOpenChange={setInviteOpen} />
        )}

        {membersQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!membersQuery.isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {search ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {filtered.map((member) => (
            <OrgMemberRow
              key={member.id}
              member={member}
              orgId={orgId!}
              isMe={member.user.id === currentUser?.id}
            />
          ))}
        </div>
      </div>
    </SettingsLayout>
  );
}

function OrgMemberRow({
  member,
  orgId,
  isMe,
}: { member: OrgMember; orgId: string; isMe: boolean }) {
  const queryClient = useQueryClient();

  const updateRoleMutation = useMutation({
    mutationFn: (role: string) =>
      apiClient.patch(`/organizations/${orgId}/members/${member.id}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
      toast('역할이 변경되었습니다.');
    },
    onError: () => toast('역할 변경에 실패했습니다.'),
  });

  const removeMutation = useMutation({
    mutationFn: () => apiClient.delete(`/organizations/${orgId}/members/${member.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgId, 'members'] });
      toast('멤버가 제거되었습니다.');
    },
    onError: () => toast('멤버 제거에 실패했습니다.'),
  });

  const isOwner = member.role === 'owner';
  const canManage = !isOwner && !isMe;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3">
      <Avatar src={member.user.avatarUrl} fallback={member.user.name} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{member.user.name}</p>
          {isMe && (
            <Badge variant="outline" className="text-xs">
              나
            </Badge>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
      </div>
      <Badge variant={ROLE_VARIANTS[member.role] ?? 'outline'}>
        {ROLE_LABELS[member.role] ?? member.role}
      </Badge>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {member.role !== 'admin' && (
              <DropdownMenuItem
                onClick={() => updateRoleMutation.mutate('admin')}
                disabled={updateRoleMutation.isPending}
              >
                Admin으로 변경
              </DropdownMenuItem>
            )}
            {member.role !== 'member' && (
              <DropdownMenuItem
                onClick={() => updateRoleMutation.mutate('member')}
                disabled={updateRoleMutation.isPending}
              >
                Member로 변경
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              멤버 제거
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
