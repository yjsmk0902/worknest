import { LoginOutput } from '@worknest/core';

export type EmailVerifyMutationInput = {
  type: 'email.verify';
  server: string;
  id: string;
  otp: string;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'email.verify': {
      input: EmailVerifyMutationInput;
      output: LoginOutput;
    };
  }
}
