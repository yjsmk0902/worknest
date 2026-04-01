import { AccountDelete } from '@worknest/ui/components/accounts/account-delete';
import { AccountSettingsBreadcrumb } from '@worknest/ui/components/accounts/account-settings-breadcrumb';
import { AccountUpdate } from '@worknest/ui/components/accounts/account-update';
import { Container } from '@worknest/ui/components/layouts/containers/container';
import { Separator } from '@worknest/ui/components/ui/separator';

export const AccountSettingsContainer = () => {
  return (
    <Container type="full" breadcrumb={<AccountSettingsBreadcrumb />}>
      <div className="max-w-4xl space-y-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">General</h2>
            <Separator className="mt-3" />
          </div>
          <AccountUpdate />
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Danger Zone
            </h2>
            <Separator className="mt-3" />
          </div>
          <AccountDelete />
        </div>
      </div>
    </Container>
  );
};
