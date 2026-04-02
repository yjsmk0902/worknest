import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MoreHorizontal, Loader2, Users } from 'lucide-react';
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
import { apiClient } from '../../../../lib/api-client';
import { SettingsLayout } from '../../../../components/settings/settings-layout';
import { InvitationList } from '../../../../components/settings/invitation-list';
import { useWorkspaceContext } from '../../../../contexts/workspace-context';

export const Route = createFileRoute(
  '/_app/$orgSlug/$wsSlug/settings/members',
)({
  component: WorkspaceSettingsMembers,
});

interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'admin' | 'member' | 'guest';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

function WorkspaceSettingsMembers() {
  const { orgSlug, wsSlug } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const membersQuery = useQuery({
    queryKey: ['workspace', wsId, 'members'],
    queryFn: () => apiClient.getList<Member>(`/workspaces/${wsId}/members`),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => apiClient.patch(`/workspace-members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspace', wsId, 'members'],
      });
      toast('역할이 변경되었습니다.');
    },
    onError: () => {
      toast('역할 변경에 실패했습니다.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.delete(`/workspace-members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspace', wsId, 'members'],
      });
      toast('멤버가 제거되었습니다.');
    },
    onError: () => {
      toast('멤버 제거에 실패했습니다.');
    },
  });

  const members = membersQuery.data?.data ?? [];
  const filteredMembers = members.filter(
    (m) =>
      m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <SettingsLayout orgSlug={orgSlug} wsSlug={wsSlug} activeTab="members">
      <div className="max-w-[720px] space-y-8 p-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">멤버</h2>
          <p className="text-sm text-muted-foreground">
            워크스페이스 멤버를 관리합니다.
          </p>
        </div>

        {/* Search + invite */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="멤버 검색..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Members table */}
        {membersQuery.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        )}

        {membersQuery.isError && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-8 text-center">
            <p className="text-sm text-destructive">
              멤버 목록을 불러올 수 없습니다.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => membersQuery.refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {membersQuery.isSuccess && (
          <>
            {filteredMembers.length === 0 ? (
              <div className="rounded-md border border-border bg-muted/50 p-8 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {searchQuery
                    ? '검색 결과가 없습니다.'
                    : '멤버가 없습니다.'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border">
                {/* Table header */}
                <div className="flex items-center border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <div className="flex-1">이름</div>
                  <div className="w-[200px]">이메일</div>
                  <div className="w-[120px]">역할</div>
                  <div className="w-[48px]" />
                </div>

                {/* Member rows */}
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/50"
                    style={{ minHeight: '56px' }}
                  >
                    <div className="flex flex-1 items-center gap-3">
                      <Avatar
                        src={member.user.avatarUrl}
                        fallback={member.user.name}
                        size="md"
                      />
                      <span className="truncate text-sm font-medium">
                        {member.user.name}
                      </span>
                    </div>
                    <div className="w-[200px] truncate text-sm text-muted-foreground">
                      {member.user.email}
                    </div>
                    <div className="w-[120px]">
                      <RoleSelect
                        value={member.role}
                        onChange={(role) =>
                          updateRoleMutation.mutate({
                            memberId: member.id,
                            role,
                          })
                        }
                        disabled={updateRoleMutation.isPending}
                      />
                    </div>
                    <div className="w-[48px] text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() =>
                              removeMemberMutation.mutate(member.id)
                            }
                          >
                            멤버 제거
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Separator />

        {/* Pending invitations */}
        <InvitationList workspaceId={wsId} />
      </div>
    </SettingsLayout>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (role: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs capitalize"
          disabled={disabled}
        >
          {value}
          {disabled && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {['admin', 'member', 'guest'].map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => onChange(role)}
            className="capitalize"
          >
            {role === value && (
              <span className="mr-2 text-primary">&#10003;</span>
            )}
            {role}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
