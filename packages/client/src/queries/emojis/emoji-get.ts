import { Emoji } from '@worknest/client/types/emojis';

export type EmojiGetQueryInput = {
  type: 'emoji.get';
  id: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'emoji.get': {
      input: EmojiGetQueryInput;
      output: Emoji | null;
    };
  }
}
