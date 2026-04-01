import { Icon } from '@worknest/client/types/icons';

export type IconListQueryInput = {
  type: 'icon.list';
  category: string;
  page: number;
  count: number;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'icon.list': {
      input: IconListQueryInput;
      output: Icon[];
    };
  }
}
