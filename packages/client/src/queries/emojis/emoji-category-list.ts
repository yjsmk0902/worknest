import { EmojiCategory } from '@worknest/client/types/emojis';

export type EmojiCategoryListQueryInput = {
  type: 'emoji.category.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'emoji.category.list': {
      input: EmojiCategoryListQueryInput;
      output: EmojiCategory[];
    };
  }
}
