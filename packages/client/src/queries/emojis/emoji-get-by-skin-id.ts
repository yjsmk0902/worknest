import { Emoji } from '@worknest/client/types/emojis';

export type EmojiGetBySkinIdQueryInput = {
  type: 'emoji.get.by.skin.id';
  id: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'emoji.get.by.skin.id': {
      input: EmojiGetBySkinIdQueryInput;
      output: Emoji | null;
    };
  }
}
