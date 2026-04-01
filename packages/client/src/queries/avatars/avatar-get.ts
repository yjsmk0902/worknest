import { Avatar } from '@worknest/client/types/avatars';

export type AvatarGetQueryInput = {
  type: 'avatar.get';
  accountId: string;
  avatarId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'avatar.get': {
      input: AvatarGetQueryInput;
      output: Avatar | null;
    };
  }
}
