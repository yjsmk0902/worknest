import { apiClient } from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  toast,
} from '@worknest/ui';
import { Copy, Link2, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
}

interface ShareRow {
  id: string;
  pageId: string;
  token: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Dialog that lists/creates/revokes public share links for a wiki page.
 * A "live" share has no `revokedAt` and is not past its `expiresAt`.
 */
export function ShareModal({ open, onOpenChange, pageId }: ShareModalProps) {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sharesQuery = useQuery({
    queryKey: ['wiki-page-shares', pageId],
    queryFn: () => apiClient.getList<ShareRow>(`/wiki-pages/${pageId}/shares`),
    enabled: open,
  });

  const shares = sharesQuery.data?.data ?? [];
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['wiki-page-shares', pageId] });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post<ShareRow>(`/wiki-pages/${pageId}/shares`, {}),
    onSuccess: invalidate,
    onError: () => toast('공유 링크 생성에 실패했습니다.'),
  });

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) =>
      apiClient.delete(`/wiki-pages/${pageId}/shares/${shareId}`),
    onSuccess: invalidate,
    onError: () => toast('링크 해제에 실패했습니다.'),
  });

  const buildShareUrl = (token: string) =>
    `${window.location.origin}/wiki-share/${token}`;

  const handleCopy = async (id: string, token: string) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(token));
      setCopiedId(id);
      toast('링크가 복사되었습니다.');
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast('복사에 실패했습니다.');
    }
  };

  const isLive = (s: ShareRow) => {
    if (s.revokedAt) return false;
    if (s.expiresAt && new Date(s.expiresAt) <= new Date()) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>페이지 공유</DialogTitle>
          <DialogDescription className="text-[13px] leading-[1.55]">
            링크가 있는 모든 사용자가 읽기 전용으로 이 페이지를 열 수 있습니다.
            로그인 없이 접근 가능하므로 외부 공유 시 주의하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            variant="default"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            <span>새 공유 링크 생성</span>
          </Button>

          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden rounded-md border border-[color:var(--border-subtle)]">
            {sharesQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-[color:var(--fg-3)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[12.5px]">불러오는 중...</span>
              </div>
            ) : shares.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12.5px] text-[color:var(--fg-3)]">
                아직 생성된 공유 링크가 없습니다
              </p>
            ) : (
              <ul className="w-full divide-y divide-[color:var(--border-subtle)]">
                {shares.map((share) => {
                  const live = isLive(share);
                  return (
                    <li
                      key={share.id}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11.5px] text-[color:var(--fg-2)]">
                          {buildShareUrl(share.token)}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[color:var(--fg-3)]">
                          {live ? (
                            <span className="text-emerald-500">● 활성</span>
                          ) : (
                            <span className="text-[color:var(--fg-4)]">● 해제됨</span>
                          )}
                          <span className="text-[color:var(--fg-4)]">·</span>
                          <span className="truncate">
                            {new Date(share.createdAt).toLocaleString('ko-KR')}
                          </span>
                        </p>
                      </div>
                      {/* Reserve space for actions regardless of live state
                          so the right edge aligns across rows. */}
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleCopy(share.id, share.token)}
                          title="링크 복사"
                          disabled={!live}
                          className={`grid h-7 w-7 place-items-center rounded-sm text-[color:var(--fg-3)] hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)] ${
                            live ? '' : 'invisible'
                          }`}
                        >
                          <Copy
                            className={`h-3.5 w-3.5 ${copiedId === share.id ? 'text-emerald-500' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => revokeMutation.mutate(share.id)}
                          disabled={!live || revokeMutation.isPending}
                          title="링크 해제"
                          className={`grid h-7 w-7 place-items-center rounded-sm text-[color:var(--fg-3)] hover:bg-[color:var(--priority-urgent)]/10 hover:text-[color:var(--priority-urgent)] ${
                            live ? '' : 'invisible'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
