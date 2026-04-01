import { Emoji } from '@worknest/client/types/emojis';

export type EmojiListQueryInput = {
  type: 'emoji.list';
  category: string;
  page: number;
  count: number;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'emoji.list': {
      input: EmojiListQueryInput;
      output: Emoji[];
    };
  }
}
