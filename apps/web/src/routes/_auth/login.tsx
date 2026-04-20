import { useMutation } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { ApiError, apiClient } from '../../lib/api-client';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

type LoginForm = z.infer<typeof loginSchema>;

async function resolveRedirect(): Promise<string> {
  try {
    const orgsRes = await apiClient.getList<{ id: string; slug: string }>('/organizations');
    if (orgsRes.data.length === 0) return '/onboarding';
    const firstOrg = orgsRes.data[0];
    const wsRes = await apiClient.getList<{ id: string; slug: string }>(
      `/organizations/${firstOrg.id}/workspaces`,
    );
    if (wsRes.data.length > 0) {
      return `/${firstOrg.slug}/${wsRes.data[0].slug}`;
    }
    return '/orgs';
  } catch {
    return '/orgs';
  }
}

function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      await apiClient.post('/auth/login', data);
      const redirect = await resolveRedirect();
      return redirect;
    },
    onSuccess: (redirect) => {
      setIsRedirecting(true);
      window.location.href = redirect;
    },
  });

  const apiError = loginMutation.error;
  const isRateLimited = apiError instanceof ApiError && apiError.status === 429;
  const isAuthError =
    apiError instanceof ApiError && (apiError.status === 401 || apiError.status === 422);
  const hasError = !!apiError && !isRateLimited && !isAuthError;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const errors: Partial<Record<keyof LoginForm, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginForm;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    loginMutation.mutate(result.data);
  }

  const isLoading = loginMutation.isPending || isRedirecting;

  // Full-screen loading overlay during redirect to prevent page flicker
  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">이동 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col">
      <h1 className="mb-8 text-[30px] font-semibold tracking-[-0.025em] text-[color:var(--fg-1)]">
        로그인
      </h1>

      {isRateLimited && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-sm text-destructive">
            <p>로그인 시도가 너무 많습니다.</p>
            <p>5분 후에 다시 시도해주세요.</p>
          </div>
        </div>
      )}

      {isAuthError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">이메일 또는 비밀번호가 올바르지 않습니다.</p>
        </div>
      )}

      {hasError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            로그인에 실패했습니다. 잠시 후 다시 시도해주세요.
          </p>
        </div>
      )}

      <form aria-label="로그인" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" error={!!fieldErrors.email}>
            이메일
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            disabled={isLoading || isRateLimited}
            error={!!fieldErrors.email}
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <Label htmlFor="password" error={!!fieldErrors.password}>
              비밀번호
            </Label>
            <a
              href="#"
              className="ml-auto text-[12px] text-[color:var(--fg-3)] transition-colors hover:text-[color:var(--fg-1)]"
            >
              잊으셨나요?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isLoading || isRateLimited}
              error={!!fieldErrors.password}
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--fg-3)] hover:text-[color:var(--fg-1)]"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" disabled={isLoading || isRateLimited}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              로그인 중...
            </>
          ) : (
            '로그인'
          )}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-2 text-[13px] text-[color:var(--fg-3)]">
        <span>계정이 없으신가요?</span>
        <Link to="/register" className="font-medium text-[color:var(--fg-1)] hover:underline">
          회원가입
        </Link>
      </div>

      <div className="my-8 flex items-center gap-3 text-[11px] text-[color:var(--fg-4)]">
        <div className="h-px flex-1 bg-[color:var(--border-subtle)]" />
        <span>또는</span>
        <div className="h-px flex-1 bg-[color:var(--border-subtle)]" />
      </div>

      <Button variant="outline" size="lg" className="w-full" disabled>
        SSO로 계속하기
      </Button>
    </div>
  );
}
