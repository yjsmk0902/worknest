import { LoginOutput } from '@worknest/core';

export type EmailLoginMutationInput = {
  type: 'email.login';
  server: string;
  email: string;
  password: string;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'email.login': {
      input: EmailLoginMutationInput;
      output: LoginOutput;
    };
  }
}
