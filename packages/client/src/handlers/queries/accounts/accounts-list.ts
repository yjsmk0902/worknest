import { SelectAccount } from '@worknest/client/databases/app';
import { mapAccount } from '@worknest/client/lib/mappers';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { AccountListQueryInput } from '@worknest/client/queries/accounts/account-list';
import { AppService } from '@worknest/client/services/app-service';
import { Account } from '@worknest/client/types/accounts';
import { Event } from '@worknest/client/types/events';

export class AccountListQueryHandler
  implements QueryHandler<AccountListQueryInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(_: AccountListQueryInput): Promise<Account[]> {
    const rows = await this.fetchAccounts();
    return rows.map(mapAccount);
  }

  public async checkForChanges(
    event: Event,
    _: AccountListQueryInput,
    output: Account[]
  ): Promise<ChangeCheckResult<AccountListQueryInput>> {
    if (event.type === 'account.created') {
      const newAccounts = [...output, event.account];
      return {
        hasChanges: true,
        result: newAccounts,
      };
    }

    if (event.type === 'account.updated') {
      const updatedAccounts = [...output].map((account) => {
        if (account.id === event.account.id) {
          return event.account;
        }
        return account;
      });

      return {
        hasChanges: true,
        result: updatedAccounts,
      };
    }

    if (event.type === 'account.deleted') {
      const activeAccounts = [...output].filter(
        (account) => account.id !== event.account.id
      );

      return {
        hasChanges: true,
        result: activeAccounts,
      };
    }

    return {
      hasChanges: false,
    };
  }

  private fetchAccounts(): Promise<SelectAccount[]> {
    return this.app.database.selectFrom('accounts').selectAll().execute();
  }
}
