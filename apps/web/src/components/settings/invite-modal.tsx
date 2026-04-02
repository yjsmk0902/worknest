import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@worknest/ui';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { apiClient } from '../../lib/api-client';
import { toast } from '@worknest/ui';

interface InviteModalProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inviteSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  role: z.enum(['admin', 'member', 'guest']),
});

type InviteForm = z.infer<typeof inviteSchema>;

const ROLES = [
  { value: 'admin' as const, label: 'Admin' },
  { value: 'member' as const, label: 'Member' },
  { value: 'guest' as const, label: 'Guest' },
];

export function InviteModal({
  workspaceId,
  open,
  onOpenChange,
}: InviteModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<InviteForm>({
    email: '',
    role: 'member',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof InviteForm, string>>
  >({});

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) =>
      apiClient.post(`/workspaces/${workspaceId}/invitations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'invitations'],
      });
      toast('초대 메일이 발송되었습니다.');
      setFormData({ email: '', role: 'member' });
      setFieldErrors({});
      onOpenChange(false);
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
          <DialogDescription>
            이메일 주소로 워크스페이스에 멤버를 초대합니다.
          </DialogDescription>
        </DialogHeader>

        {inviteMutation.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">
              {inviteMutation.error.message}
            </p>
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
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
      </DialogContent>
    </Dialog>
  );
}
