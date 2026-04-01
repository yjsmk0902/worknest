import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { LogoutBreadcrumb } from '@worknest/ui/components/auth/logout-breadcrumb';
import { Container } from '@worknest/ui/components/layouts/containers/container';
import { Button } from '@worknest/ui/components/ui/button';
import { Separator } from '@worknest/ui/components/ui/separator';
import { Spinner } from '@worknest/ui/components/ui/spinner';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useMutation } from '@worknest/ui/hooks/use-mutation';

export const LogoutContainer = () => {
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const { mutate, isPending } = useMutation();

  return (
    <Container type="full" breadcrumb={<LogoutBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Logout</h2>
            <Separator className="mt-3" />
          </div>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold">Sign out of your account</h3>
              <p className="text-sm text-muted-foreground">
                All your data will be removed from this device. If there are
                pending changes, they will be lost. If you login again, all the
                data will be re-synced.
              </p>
            </div>
            <div className="w-full md:w-auto md:shrink-0">
              <Button
                variant="destructive"
                disabled={isPending}
                className="w-full cursor-pointer md:w-20"
                onClick={async () => {
                  mutate({
                    input: {
                      type: 'account.logout',
                      accountId: workspace.accountId,
                    },
                    onSuccess() {
                      navigate({
                        to: '/',
                        replace: true,
                      });
                    },
                    onError(error) {
                      toast.error(error.message);
                    },
                  });
                }}
              >
                {isPending && <Spinner className="mr-1" />}
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
};
