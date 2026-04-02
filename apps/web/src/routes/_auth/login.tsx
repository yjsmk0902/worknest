import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { apiClient, ApiError } from '../../lib/api-client';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginForm>({
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof LoginForm, string>>
  >({});

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) =>
      apiClient.post('/auth/login', data),
    onSuccess: () => {
      navigate({ to: '/_app/orgs' });
    },
  });

  const apiError = loginMutation.error;
  const isRateLimited =
    apiError instanceof ApiError && apiError.status === 429;
  const isInvalidCredentials =
    apiError instanceof ApiError && apiError.code === 'INVALID_CREDENTIALS';

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

  const isLoading = loginMutation.isPending;

  return (
    <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground">로그인</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          워크스페이스에 로그인하세요
        </p>
      </div>

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

      {isInvalidCredentials && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            이메일 또는 비밀번호가 올바르지 않습니다.
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
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldErrors.email}
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
              autoComplete="current-password"
              disabled={isLoading || isRateLimited}
              error={!!fieldErrors.password}
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
              }
              aria-describedby={
                fieldErrors.password ? 'password-error' : undefined
              }
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isLoading || isRateLimited}
        >
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

      <p className="mt-4 text-center text-sm text-muted-foreground">
        계정이 없으신가요?{' '}
        <Link
          to="/register"
          className="font-medium text-primary hover:underline"
        >
          회원가입
        </Link>
      </p>
    </div>
  );
}
