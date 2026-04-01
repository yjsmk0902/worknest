import { Emoji } from '@worknest/client/types/emojis';

export type EmojiSearchQueryInput = {
  type: 'emoji.search';
  query: string;
  count: number;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'emoji.search': {
      input: EmojiSearchQueryInput;
      output: Emoji[];
    };
  }
}
