import { JobHandler } from '@worknest/server/jobs';
import { sendEmailPasswordResetEmail } from '@worknest/server/lib/accounts';

export type EmailPasswordResetSendInput = {
  type: 'email.password.reset.send';
  otpId: string;
};

declare module '@worknest/server/jobs' {
  interface JobMap {
    'email.password.reset.send': {
      input: EmailPasswordResetSendInput;
    };
  }
}

export const emailPasswordResetSendHandler: JobHandler<
  EmailPasswordResetSendInput
> = async (input) => {
  const { otpId } = input;
  await sendEmailPasswordResetEmail(otpId);
};
