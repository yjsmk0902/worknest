import { IconCategory } from '@worknest/client/types/icons';

export type IconCategoryListQueryInput = {
  type: 'icon.category.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'icon.category.list': {
      input: IconCategoryListQueryInput;
      output: IconCategory[];
    };
  }
}
