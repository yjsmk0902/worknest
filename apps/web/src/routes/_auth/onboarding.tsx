import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import {
  Loader2,
  AlertTriangle,
  Building2,
  Users,
  Rocket,
  FolderKanban,
  UserPlus,
  FileText,
} from 'lucide-react';
import { z } from 'zod';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { apiClient, ApiError } from '../../lib/api-client';

export const Route = createFileRoute('/_auth/onboarding')({
  component: OnboardingPage,
});

const TOTAL_STEPS = 3;

const orgSchema = z.object({
  name: z.string().min(1, '조직 이름을 입력해주세요.').max(100, '100자 이하여야 합니다.'),
});

const wsSchema = z.object({
  name: z.string().min(1, '워크스페이스 이름을 입력해주세요.').max(100, '100자 이하여야 합니다.'),
});

function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [orgTab, setOrgTab] = useState<'create' | 'join'>('create');

  // Step 1: Org
  const [orgData, setOrgData] = useState({ name: '' });
  const [orgErrors, setOrgErrors] =
    useState<Partial<Record<string, string>>>();
  const [createdOrgId, setCreatedOrgId] = useState('');
  const [createdOrgSlug, setCreatedOrgSlug] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Step 2: Workspace
  const [wsData, setWsData] = useState({ name: '' });
  const [wsErrors, setWsErrors] =
    useState<Partial<Record<string, string>>>();
  const [createdWsSlug, setCreatedWsSlug] = useState('');

  const createOrgMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiClient.post<{ id: string; slug: string }>('/organizations', data),
    onSuccess: (result) => {
      setCreatedOrgId(result.id);
      setCreatedOrgSlug(result.slug);
      setStep(2);
    },
  });

  const createWsMutation = useMutation({
    mutationFn: (data: { name: string }) =>
      apiClient.post<{ id: string; slug: string }>(
        `/organizations/${createdOrgId}/workspaces`,
        data,
      ),
    onSuccess: (result) => {
      setCreatedWsSlug(result.slug);
      setStep(3);
    },
  });

  function handleOrgSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOrgErrors(undefined);

    const result = orgSchema.safeParse(orgData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!errors[field]) errors[field] = issue.message;
      }
      setOrgErrors(errors);
      return;
    }

    createOrgMutation.mutate(result.data);
  }

  function handleWsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWsErrors(undefined);

    const result = wsSchema.safeParse(wsData);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!errors[field]) errors[field] = issue.message;
      }
      setWsErrors(errors);
      return;
    }

    createWsMutation.mutate(result.data);
  }

  function handleFinish() {
    if (createdOrgSlug && createdWsSlug) {
      // Use window.location for a clean navigation that goes through the _app layout
      window.location.href = `/${createdOrgSlug}/${createdWsSlug}`;
    } else {
      window.location.href = '/orgs';
    }
  }

  function handleSkip() {
    if (step === 1) {
      // Cannot skip org creation — required to enter the app
      return;
    } else if (step === 2) {
      // Auto-create a default workspace when skipping
      createWsMutation.mutate({ name: '기본 워크스페이스' });
    } else {
      handleFinish();
    }
  }

  return (
    <div className="w-full max-w-[560px]">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {step} / {TOTAL_STEPS} 단계
          </span>
          {step > 1 && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              건너뛰기
            </button>
          )}
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        {/* Step 1: Org Creation or Join */}
        {step === 1 && (
          <>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  조직 설정
                </h2>
                <p className="text-sm text-muted-foreground">
                  새 조직을 만들거나 기존 조직에 참여하세요.
                </p>
              </div>
            </div>

            {/* Tab selector */}
            <div className="mb-4 flex rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setOrgTab('create')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  orgTab === 'create'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                새 조직 만들기
              </button>
              <button
                type="button"
                onClick={() => setOrgTab('join')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                  orgTab === 'join'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                초대 코드로 참여
              </button>
            </div>

            {createOrgMutation.error && orgTab === 'create' && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">
                  {createOrgMutation.error.message}
                </p>
              </div>
            )}

            {orgTab === 'create' ? (
              <form onSubmit={handleOrgSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name" error={!!orgErrors?.name}>
                    조직 이름
                  </Label>
                  <Input
                    id="org-name"
                    placeholder="Acme Corporation"
                    disabled={createOrgMutation.isPending}
                    error={!!orgErrors?.name}
                    value={orgData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setOrgData({ name });
                    }}
                  />
                  {orgErrors?.name && (
                    <p className="text-sm text-destructive">{orgErrors.name}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createOrgMutation.isPending}
                >
                  {createOrgMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    '조직 만들기'
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">초대 코드</Label>
                  <Input
                    id="invite-code"
                    placeholder="초대 코드를 입력하세요"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!inviteCode.trim()}
                  onClick={() => {
                    // TODO: Accept invitation API call
                    // POST /api/v1/invitations/accept { token: inviteCode }
                    alert('초대 수락 기능은 곧 지원될 예정입니다.');
                  }}
                >
                  조직 참여
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  조직 관리자에게 초대 코드를 받으세요
                </p>
              </div>
            )}
          </>
        )}

        {/* Step 2: Workspace Creation */}
        {step === 2 && (
          <>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  워크스페이스 만들기
                </h2>
                <p className="text-sm text-muted-foreground">
                  팀별 워크스페이스를 만들어 작업을 구분하세요.
                </p>
              </div>
            </div>

            {createWsMutation.error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">
                  {createWsMutation.error.message}
                </p>
              </div>
            )}

            <form onSubmit={handleWsSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ws-name" error={!!wsErrors?.name}>
                  워크스페이스 이름
                </Label>
                <Input
                  id="ws-name"
                  placeholder="개발팀"
                  disabled={createWsMutation.isPending}
                  error={!!wsErrors?.name}
                  value={wsData.name}
                  onChange={(e) => {
                    setWsData({ name: e.target.value });
                  }}
                />
                {wsErrors?.name && (
                  <p className="text-sm text-destructive">{wsErrors.name}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={createWsMutation.isPending}
              >
                {createWsMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  '워크스페이스 만들기'
                )}
              </Button>
            </form>
          </>
        )}

        {/* Step 3: Start Guide */}
        {step === 3 && (
          <>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Rocket className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  시작 가이드
                </h2>
                <p className="text-sm text-muted-foreground">
                  어떤 것부터 시작할까요?
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleFinish}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                <FolderKanban className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    프로젝트 만들기
                  </p>
                  <p className="text-xs text-muted-foreground">
                    이슈 관리를 시작하세요
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                <UserPlus className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    팀원 초대
                  </p>
                  <p className="text-xs text-muted-foreground">
                    이메일로 팀원을 초대하세요
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={handleFinish}
                className="flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
              >
                <FileText className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Wiki 시작
                  </p>
                  <p className="text-xs text-muted-foreground">
                    팀 문서를 작성하세요
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleFinish}
              >
                나중에 할게요
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
