import { TempFile } from '@worknest/client/types';

export type AvatarUploadMutationInput = {
  type: 'avatar.upload';
  accountId: string;
  file: TempFile;
};

export type AvatarUploadMutationOutput = {
  id: string;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'avatar.upload': {
      input: AvatarUploadMutationInput;
      output: AvatarUploadMutationOutput;
    };
  }
}
