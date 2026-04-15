import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@worknest/ui';
import { Skeleton } from '@worknest/ui';
import { Badge } from '@worknest/ui';
import { toast } from '@worknest/ui';
import { Loader2, Mail, RefreshCw, UserPlus, X } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { InviteModal } from './invite-modal';

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface InvitationListProps {
  workspaceId: string;
}

export function InvitationList({ workspaceId }: InvitationListProps) {
  const queryClient = useQueryClient();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const invitationsQuery = useQuery({
    queryKey: ['workspaces', workspaceId, 'invitations'],
    queryFn: () => apiClient.getList<Invitation>(`/workspaces/${workspaceId}/invitations`),
  });

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => apiClient.post(`/invitations/${invitationId}/resend`),
    onSuccess: () => {
      toast('초대 메일이 재발송되었습니다.');
    },
    onError: () => {
      toast('재발송에 실패했습니다. 다시 시도해주세요.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) => apiClient.delete(`/invitations/${invitationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'invitations'],
      });
      toast('초대가 취소되었습니다.');
    },
    onError: () => {
      toast('초대 취소에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function getDaysRemaining(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return '만료됨';
    return `${days}일 남음`;
  }

  if (invitationsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (invitationsQuery.isError) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-center text-sm text-destructive">
        초대 목록을 불러올 수 없습니다.
      </div>
    );
  }

  const invitations = invitationsQuery.data?.data ?? [];
  const pendingInvitations = invitations.filter((inv) => !inv.acceptedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">대기 중인 초대</h3>
        <Button size="sm" onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="h-4 w-4" />
          멤버 초대
        </Button>
      </div>

      {pendingInvitations.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/50 p-8 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">대기 중인 초대가 없습니다.</p>
        </div>
      ) : (
        <div className="rounded-md border border-border">
          {/* Table header */}
          <div className="flex items-center border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <div className="flex-1">이메일</div>
            <div className="w-[100px]">역할</div>
            <div className="w-[100px]">만료일</div>
            <div className="w-[140px] text-right">작업</div>
          </div>

          {/* Table rows */}
          {pendingInvitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center border-b border-border px-4 py-3 last:border-b-0 hover:bg-accent/50"
            >
              <div className="flex-1 truncate text-sm">{invitation.email}</div>
              <div className="w-[100px]">
                <Badge variant="secondary" className="text-xs capitalize">
                  {invitation.role}
                </Badge>
              </div>
              <div className="w-[100px] text-xs text-muted-foreground">
                {getDaysRemaining(invitation.expiresAt)}
              </div>
              <div className="flex w-[140px] items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resendMutation.mutate(invitation.id)}
                  disabled={resendMutation.isPending}
                >
                  {resendMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  재발송
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cancelMutation.mutate(invitation.id)}
                  disabled={cancelMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  취소
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <InviteModal
        workspaceId={workspaceId}
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
      />
    </div>
  );
}
