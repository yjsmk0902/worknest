import {
  UserCreateErrorOutput,
  UserCreateInput,
  UserOutput,
} from '@worknest/core';

export type UsersCreateMutationInput = {
  type: 'users.create';
  userId: string;
  users: UserCreateInput[];
};

export type UsersCreateMutationOutput = {
  users: UserOutput[];
  errors: UserCreateErrorOutput[];
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'users.create': {
      input: UsersCreateMutationInput;
      output: UsersCreateMutationOutput;
    };
  }
}
