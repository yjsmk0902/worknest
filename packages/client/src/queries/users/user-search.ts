import { User } from '@worknest/client/types/users';

export type UserSearchQueryInput = {
  type: 'user.search';
  searchQuery: string;
  userId: string;
  exclude?: string[];
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'user.search': {
      input: UserSearchQueryInput;
      output: User[];
    };
  }
}
