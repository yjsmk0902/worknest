import { LoginOutput } from '@worknest/core';

export type GoogleLoginMutationInput = {
  type: 'google.login';
  server: string;
  code: string;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'google.login': {
      input: GoogleLoginMutationInput;
      output: LoginOutput;
    };
  }
}
