import { Account } from '@worknest/client/types/accounts';

export type AccountListQueryInput = {
  type: 'account.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'account.list': {
      input: AccountListQueryInput;
      output: Account[];
    };
  }
}
