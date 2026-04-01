import { User } from '@worknest/client/types/users';

export type UserListQueryInput = {
  type: 'user.list';
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'user.list': {
      input: UserListQueryInput;
      output: User[];
    };
  }
}
