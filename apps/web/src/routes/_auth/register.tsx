import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { apiClient, ApiError } from '../../lib/api-client';

export const Route = createFileRoute('/_auth/register')({
  component: RegisterPage,
});

const registerSchema = z.object({
  name: z
    .string()
    .min(1, '이름을 입력해주세요.')
    .max(50, '이름은 50자 이하여야 합니다.'),
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type RegisterForm = z.infer<typeof registerSchema>;

function RegisterPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<RegisterForm>({
    name: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegisterForm, string>>
  >({});

  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) =>
      apiClient.post('/auth/register', data),
    onSuccess: () => {
      navigate({ to: '/onboarding' });
    },
  });

  const apiError = registerMutation.error;
  const isDuplicateEmail =
    apiError instanceof ApiError && apiError.code === 'EMAIL_ALREADY_EXISTS';

  function handleSubmit(e: React.FormEvent) {
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

    registerMutation.mutate(result.data);
  }

  const isLoading = registerMutation.isPending;

  return (
    <div className="mx-auto max-w-[400px] rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground">회원가입</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          새 계정을 만들어 시작하세요
        </p>
      </div>

      {isDuplicateEmail && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">
            이미 사용 중인 이메일입니다.{' '}
            <Link
              to="/login"
              className="font-medium underline hover:no-underline"
            >
              로그인 페이지
            </Link>
            로 이동하시겠습니까?
          </p>
        </div>
      )}

      {apiError && !isDuplicateEmail && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{apiError.message}</p>
        </div>
      )}

      <form aria-label="회원가입" onSubmit={handleSubmit} className="space-y-4">
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
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          />
          {fieldErrors.name && (
            <p id="name-error" className="text-sm text-destructive">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" error={!!fieldErrors.email}>
            이메일
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            autoComplete="email"
            disabled={isLoading}
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
              autoComplete="new-password"
              disabled={isLoading}
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
          <p className="text-xs text-muted-foreground">
            8자 이상, 영문/숫자 포함
          </p>
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
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              계정 생성 중...
            </>
          ) : (
            '회원가입'
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
