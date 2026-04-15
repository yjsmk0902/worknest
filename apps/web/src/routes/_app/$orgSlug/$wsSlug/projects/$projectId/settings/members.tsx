import { ProjectSettingsLayout } from '@/components/projects/settings-layout';
import { useProjectContext } from '@/contexts/project-context';
import { useWorkspaceContext } from '@/contexts/workspace-context';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Avatar } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import { Separator } from '@worknest/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@worknest/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@worknest/ui';
import { toast } from '@worknest/ui';
import { AlertTriangle, Loader2, MoreHorizontal, Search, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_app/$orgSlug/$wsSlug/projects/$projectId/settings/members')(
  {
    component: ProjectSettingsMembers,
  },
);

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

function ProjectSettingsMembers() {
  const { orgSlug, wsSlug, projectId } = Route.useParams();
  const { wsId } = useWorkspaceContext();
  const { projectName } = useProjectContext();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [removeMember, setRemoveMember] = useState<ProjectMember | null>(null);

  const membersQuery = useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: () => apiClient.getList<ProjectMember>(`/projects/${projectId}/members`),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: string;
    }) => apiClient.patch(`/projects/${projectId}/members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'members'],
      });
      toast('역할이 변경되었습니다.');
    },
    onError: () => {
      toast('역할 변경에 실패했습니다.');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiClient.delete(`/projects/${projectId}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'members'],
      });
      toast('멤버가 제거되었습니다.');
      setRemoveMember(null);
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
    <ProjectSettingsLayout
      orgSlug={orgSlug}
      wsSlug={wsSlug}
      projectId={projectId}
      projectName={projectName}
      activeTab="members"
    >
      <div className="max-w-[720px] space-y-8 p-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">멤버</h2>
          <p className="text-sm text-muted-foreground">프로젝트 멤버를 관리합니다.</p>
        </div>

        {/* Search + add member */}
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
          <Button size="sm" onClick={() => setAddMemberModalOpen(true)}>
            <UserPlus className="h-4 w-4" />
            멤버 추가
          </Button>
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
            <p className="text-sm text-destructive">멤버 목록을 불러올 수 없습니다.</p>
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

        {/* Members table */}
        {membersQuery.isSuccess &&
          (filteredMembers.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/50 p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                {searchQuery ? '검색 결과가 없습니다.' : '아직 다른 멤버가 없습니다'}
              </p>
              {!searchQuery && (
                <Button size="sm" className="mt-4" onClick={() => setAddMemberModalOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  멤버 추가
                </Button>
              )}
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
                    <Avatar src={member.user.avatarUrl} fallback={member.user.name} size="md" />
                    <span className="truncate text-sm font-medium">{member.user.name}</span>
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
                        <Button variant="ghost" size="icon" aria-label="작업 메뉴">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemoveMember(member)}
                        >
                          멤버 제거
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Add Member Modal */}
      <AddMemberModal
        projectId={projectId}
        wsId={wsId}
        existingMemberIds={members.map((m) => m.userId)}
        open={addMemberModalOpen}
        onOpenChange={setAddMemberModalOpen}
        onSuccess={() =>
          queryClient.invalidateQueries({
            queryKey: ['projects', projectId, 'members'],
          })
        }
      />

      {/* Remove Member Confirmation */}
      <Dialog
        open={removeMember !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveMember(null);
        }}
      >
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>멤버 제거</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              &quot;{removeMember?.user.name}&quot; 님을 프로젝트에서 제거하시겠습니까?
            </p>
            <p className="text-sm text-muted-foreground">
              이 멤버의 이슈 할당은 유지되지만, 프로젝트에 더 이상 접근할 수 없습니다.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveMember(null)}
              disabled={removeMemberMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={removeMemberMutation.isPending}
              onClick={() => {
                if (removeMember) {
                  removeMemberMutation.mutate(removeMember.id);
                }
              }}
            >
              {removeMemberMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  제거 중...
                </>
              ) : (
                '제거'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProjectSettingsLayout>
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
  // Backend excludes "admin" from updateProjectMemberInput,
  // so show admin as read-only, otherwise offer member/viewer.
  if (value === 'admin') {
    return (
      <span className="inline-flex h-7 items-center rounded-md border border-border bg-muted px-2 text-xs capitalize text-muted-foreground">
        admin
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs capitalize"
          disabled={disabled}
          aria-label="역할 변경"
        >
          {value}
          {disabled && <Loader2 className="ml-1 h-3 w-3 animate-spin" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {['member', 'viewer'].map((role) => (
          <DropdownMenuItem key={role} onClick={() => onChange(role)} className="capitalize">
            {role === value && <span className="mr-2 text-primary">&#10003;</span>}
            {role}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddMemberModal({
  projectId,
  wsId,
  existingMemberIds,
  open,
  onOpenChange,
  onSuccess,
}: {
  projectId: string;
  wsId: string;
  existingMemberIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<
    Array<{ id: string; name: string; email: string; avatarUrl: string | null }>
  >([]);
  const [role, setRole] = useState<'member' | 'viewer'>('member');

  // Fetch workspace members to search from
  const wsMembersQuery = useQuery({
    queryKey: ['workspaces', wsId, 'members'],
    queryFn: () => apiClient.getList<WorkspaceMember>(`/workspaces/${wsId}/members`),
    enabled: open,
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { userId: string; role: string }) =>
      apiClient.post(`/projects/${projectId}/members`, data),
    onSuccess: () => {
      // Don't close yet if more to add
    },
    onError: () => {
      toast('멤버 추가에 실패했습니다.');
    },
  });

  // Filter workspace members: exclude already in project and filter by search
  const availableMembers = (wsMembersQuery.data?.data ?? []).filter(
    (m) =>
      !existingMemberIds.includes(m.userId) &&
      !selectedUsers.some((s) => s.id === m.userId) &&
      (m.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.user.email.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  function handleSelectUser(member: WorkspaceMember) {
    setSelectedUsers((prev) => [
      ...prev,
      {
        id: member.userId,
        name: member.user.name,
        email: member.user.email,
        avatarUrl: member.user.avatarUrl,
      },
    ]);
    setSearchQuery('');
  }

  function handleRemoveSelected(userId: string) {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedUsers.length === 0) return;

    try {
      for (const user of selectedUsers) {
        await addMemberMutation.mutateAsync({
          userId: user.id,
          role,
        });
      }
      toast('멤버가 추가되었습니다.');
      onSuccess();
      setSelectedUsers([]);
      setRole('member');
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  }

  // Reset on close
  function handleOpenChange(val: boolean) {
    if (!val) {
      setSelectedUsers([]);
      setSearchQuery('');
      setRole('member');
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>멤버 추가</DialogTitle>
          <DialogDescription>워크스페이스 멤버를 프로젝트에 추가합니다.</DialogDescription>
        </DialogHeader>

        {addMemberMutation.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{addMemberMutation.error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="워크스페이스 멤버 검색..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={addMemberMutation.isPending}
              />
            </div>

            {/* Search results dropdown */}
            {searchQuery.length > 0 && availableMembers.length > 0 && (
              <div className="max-h-[160px] overflow-y-auto rounded-md border border-border">
                {availableMembers.slice(0, 5).map((member) => (
                  <button
                    key={member.userId}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => handleSelectUser(member)}
                  >
                    <Avatar src={member.user.avatarUrl} fallback={member.user.name} size="sm" />
                    <span className="font-medium">{member.user.name}</span>
                    <span className="text-muted-foreground">{member.user.email}</span>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length > 0 && availableMembers.length === 0 && (
              <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>
            )}
          </div>

          {/* Selected users */}
          {selectedUsers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">선택된 멤버:</p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                  >
                    {user.name}
                    <button
                      type="button"
                      onClick={() => handleRemoveSelected(user.id)}
                      className="hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Role select */}
          <div className="space-y-2">
            <Label htmlFor="add-member-role">역할</Label>
            <select
              id="add-member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'member' | 'viewer')}
              disabled={addMemberMutation.isPending}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={addMemberMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={selectedUsers.length === 0 || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  추가 중...
                </>
              ) : (
                '멤버 추가'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
