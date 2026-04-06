import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MoreHorizontal, Loader2, Users } from 'lucide-react';
import {
  Button,
  Input,
  Avatar,
  Skeleton,
  Separator,
} from '@worknest/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import type {
  WikiSpaceMemberOutput,
  WikiSpaceRole,
} from '@worknest/shared';
import { apiClient } from '../../lib/api-client';

interface MemberWithUser extends WikiSpaceMemberOutput {
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

interface SpaceMembersProps {
  spaceId: string;
}

/**
 * Members management for a wiki space.
 *
 * Displays a list of space members with search, role change,
 * and remove functionality.
 */
export function SpaceMembers({ spaceId }: SpaceMembersProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const membersQuery = useQuery({
    queryKey: ['wiki-spaces', spaceId, 'members'],
    queryFn: () =>
      apiClient.getList<MemberWithUser>(
        `/wiki-spaces/${spaceId}/members`,
      ),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: WikiSpaceRole;
    }) =>
      apiClient.patch(`/wiki-space-members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'members'],
      });
      toast('역할이 변경되었습니다.');
    },
    onError: () => {
      toast('역할 변경에 실패했습니다.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.delete(`/wiki-space-members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', spaceId, 'members'],
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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-foreground">멤버</h3>
        <p className="text-sm text-muted-foreground">
          스페이스 멤버를 관리합니다.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="멤버 검색..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Separator />

      {/* Loading */}
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

      {/* Error */}
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

      {/* Members list */}
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
              {/* Header */}
              <div className="flex items-center border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <div className="flex-1">이름</div>
                <div className="w-[200px]">이메일</div>
                <div className="w-[120px]">역할</div>
                <div className="w-[48px]" />
              </div>

              {/* Rows */}
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/50"
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
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: WikiSpaceRole;
  onChange: (role: WikiSpaceRole) => void;
  disabled?: boolean;
}) {
  const roles: WikiSpaceRole[] = ['editor', 'viewer'];

  const labels: Record<WikiSpaceRole, string> = {
    editor: 'Editor',
    viewer: 'Viewer',
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs capitalize"
          disabled={disabled}
        >
          {labels[value]}
          {disabled && (
            <Loader2 className="ml-1 h-3 w-3 animate-spin" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => onChange(role)}
            className="capitalize"
          >
            {role === value && (
              <span className="mr-2 text-primary">&#10003;</span>
            )}
            {labels[role]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
