import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { AlertTriangle, Clock, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { ApiError, apiClient } from '../../lib/api-client';

export const Route = createFileRoute('/_auth/invite/$token')({
  component: InviteAcceptPage,
});

interface InviteInfo {
  email: string;
  orgName?: string;
  workspaceName?: string;
  role: string;
  hasAccount: boolean;
}

const registerSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.').max(100, '이름은 100자 이하여야 합니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type RegisterForm = z.infer<typeof registerSchema>;

function InviteAcceptPage() {
  const { token } = Route.useParams();
  const _navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<RegisterForm>({
    name: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({});

  const inviteQuery = useQuery<InviteInfo>({
    queryKey: ['invite', token],
    queryFn: () => apiClient.get(`/auth/invitations/${token}`),
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: (data?: RegisterForm) => apiClient.post(`/auth/invitations/${token}/accept`, data),
    onSuccess: () => {
      window.location.href = '/orgs';
    },
  });

  const queryError = inviteQuery.error;
  const isExpired =
    queryError instanceof ApiError &&
    (queryError.code === 'INVITATION_EXPIRED' || queryError.code === 'INVITATION_NOT_FOUND');
  const isAlreadyAccepted =
    queryError instanceof ApiError && queryError.code === 'INVITATION_ALREADY_ACCEPTED';

  // Loading state
  if (inviteQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">초대를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // Expired or invalid token
  if (isExpired) {
    return (
      <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Clock className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">초대가 만료되었습니다</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              이 초대 링크는 만료되었거나 유효하지 않습니다.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">관리자에게 새 초대를 요청해주세요.</p>
          </div>
          <Link to="/login">
            <Button variant="outline">로그인 페이지로 이동</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Already accepted
  if (isAlreadyAccepted) {
    return (
      <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <XCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">이미 수락된 초대입니다</h2>
            <p className="mt-1 text-sm text-muted-foreground">이 초대는 이미 사용되었습니다.</p>
          </div>
          <Link to="/login">
            <Button variant="outline">로그인</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Generic error
  if (inviteQuery.isError) {
    return (
      <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">오류가 발생했습니다</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              초대 정보를 불러올 수 없습니다. 다시 시도해주세요.
            </p>
          </div>
          <Button variant="outline" onClick={() => inviteQuery.refetch()}>
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  const invite = inviteQuery.data;
  if (!invite) return null;

  const targetName = invite.workspaceName ?? invite.orgName ?? '';

  // Existing user - login prompt
  if (invite.hasAccount) {
    return (
      <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground">초대를 수락하세요</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{targetName}</span>에 초대되었습니다
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{invite.email}</span> 계정으로 로그인하여
            초대를 수락하세요.
          </p>
        </div>

        {acceptMutation.error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{acceptMutation.error.message}</p>
          </div>
        )}

        <div className="mt-6">
          <Link to="/login" className="block">
            <Button className="w-full" size="lg">
              로그인하고 수락하기
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // New user - register form
  function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = registerSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof RegisterForm, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof RegisterForm;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    acceptMutation.mutate(result.data);
  }

  const isLoading = acceptMutation.isPending;

  return (
    <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground">초대를 수락하세요</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{targetName}</span>에 초대되었습니다. 계정을
          만들어 시작하세요.
        </p>
      </div>

      <div className="mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {invite.email}
      </div>

      {acceptMutation.error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{acceptMutation.error.message}</p>
        </div>
      )}

      <form aria-label="초대 수락 - 회원가입" onSubmit={handleRegisterSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" error={!!fieldErrors.name}>
            이름
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="홍길동"
            autoComplete="name"
            disabled={isLoading}
            error={!!fieldErrors.name}
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          />
          {fieldErrors.name && (
            <p id="name-error" className="text-sm text-destructive">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" error={!!fieldErrors.password}>
            비밀번호
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isLoading}
              error={!!fieldErrors.password}
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">8자 이상, 영문/숫자 포함</p>
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              계정 생성 중...
            </>
          ) : (
            '계정 만들고 참여하기'
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
