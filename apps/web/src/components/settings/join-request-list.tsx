import { type ListResponse, apiClient } from '@/lib/api-client';
import { formatRelativeTime } from '@/lib/format-time';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Skeleton, toast } from '@worknest/ui';
import { Check, Loader2, UserCheck, X } from 'lucide-react';

interface JoinRequest {
  id: string;
  orgId: string;
  userId: string;
  message: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

interface JoinRequestListProps {
  orgId: string;
}

export function JoinRequestList({ orgId }: JoinRequestListProps) {
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ['organizations', orgId, 'join-requests'],
    queryFn: () => apiClient.getList<JoinRequest>(`/organizations/${orgId}/join-requests`),
    enabled: !!orgId,
  });

  const reviewMutation = useMutation({
    mutationFn: (data: { requestId: string; action: 'approve' | 'reject' }) =>
      apiClient.post(`/join-requests/${data.requestId}/review`, {
        action: data.action,
      }),
    onMutate: async (data) => {
      await queryClient.cancelQueries({
        queryKey: ['organizations', orgId, 'join-requests'],
      });

      const previousData = queryClient.getQueryData<ListResponse<JoinRequest>>([
        'organizations',
        orgId,
        'join-requests',
      ]);

      queryClient.setQueryData<ListResponse<JoinRequest>>(
        ['organizations', orgId, 'join-requests'],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter((r) => r.id !== data.requestId),
          };
        },
      );

      return { previousData };
    },
    onSuccess: (_result, variables) => {
      if (variables.action === 'approve') {
        toast.success('가입 요청이 승인되었습니다.');
        queryClient.invalidateQueries({
          queryKey: ['organizations', orgId, 'members'],
        });
      } else {
        toast.success('가입 요청이 거절되었습니다.');
      }
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['organizations', orgId, 'join-requests'], context.previousData);
      }
      toast.error('요청 처리에 실패했습니다.');
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['organizations', orgId, 'join-requests'],
      });
    },
  });

  if (requestsQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const requests = requestsQuery.data?.data ?? [];

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <UserCheck className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">대기 중인 가입 요청이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <div
          key={request.id}
          className="flex items-start gap-3 rounded-lg border border-border p-3"
        >
          <Avatar src={request.user?.avatarUrl} fallback={request.user?.name ?? '?'} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">
                {request.user?.name ?? '알 수 없는 사용자'}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(request.createdAt)}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{request.user?.email}</p>
            {request.message && <p className="mt-1 text-sm text-foreground">{request.message}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950 dark:hover:text-green-300"
              disabled={reviewMutation.isPending}
              onClick={() =>
                reviewMutation.mutate({
                  requestId: request.id,
                  action: 'approve',
                })
              }
            >
              {reviewMutation.isPending &&
              reviewMutation.variables?.requestId === request.id &&
              reviewMutation.variables?.action === 'approve' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              승인
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={reviewMutation.isPending}
              onClick={() =>
                reviewMutation.mutate({
                  requestId: request.id,
                  action: 'reject',
                })
              }
            >
              {reviewMutation.isPending &&
              reviewMutation.variables?.requestId === request.id &&
              reviewMutation.variables?.action === 'reject' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              거절
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
