import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWsInvitationInput } from '@worknest/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@worknest/ui';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { toast } from '@worknest/ui';
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { apiClient } from '../../lib/api-client';

interface InviteModalProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Re-use shared schema with Korean error message for email
const inviteSchema = createWsInvitationInput.superRefine((data, ctx) => {
  if (!z.string().email().safeParse(data.email).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['email'],
      message: '올바른 이메일 주소를 입력해주세요.',
    });
  }
});

type InviteForm = z.infer<typeof inviteSchema>;

const ROLES = [
  { value: 'admin' as const, label: 'Admin' },
  { value: 'member' as const, label: 'Member' },
  { value: 'guest' as const, label: 'Guest' },
];

export function InviteModal({ workspaceId, open, onOpenChange }: InviteModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<InviteForm>({
    email: '',
    role: 'member',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof InviteForm, string>>>({});
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) =>
      apiClient.post<{ invitation: unknown; token: string }>(
        `/workspaces/${workspaceId}/invitations`,
        data,
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'invitations'],
      });
      // Show the token so admin can share it
      setInviteToken(result.token);
      toast('초대가 생성되었습니다.');
    },
    onError: () => {
      // Error is shown in the form
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = inviteSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof InviteForm, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof InviteForm;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    inviteMutation.mutate(result.data);
  }

  const isLoading = inviteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px]">
        <DialogHeader>
          <DialogTitle>멤버 초대</DialogTitle>
          <DialogDescription>이메일 주소로 워크스페이스에 멤버를 초대합니다.</DialogDescription>
        </DialogHeader>

        {inviteToken ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">아래 초대 코드를 상대방에게 전달하세요.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono break-all">
                {inviteToken}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  navigator.clipboard.writeText(inviteToken);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button
                className="w-full"
                onClick={() => {
                  setInviteToken(null);
                  setFormData({ email: '', role: 'member' });
                  onOpenChange(false);
                }}
              >
                완료
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {inviteMutation.error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{inviteMutation.error.message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email" error={!!fieldErrors.email}>
                  이메일
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@company.com"
                  disabled={isLoading}
                  error={!!fieldErrors.email}
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                />
                {fieldErrors.email && (
                  <p className="text-sm text-destructive">{fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-role">역할</Label>
                <select
                  id="invite-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      role: e.target.value as InviteForm['role'],
                    }))
                  }
                  disabled={isLoading}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      발송 중...
                    </>
                  ) : (
                    '초대 보내기'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
