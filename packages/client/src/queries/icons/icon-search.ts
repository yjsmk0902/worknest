import { Icon } from '@worknest/client/types/icons';

export type IconSearchQueryInput = {
  type: 'icon.search';
  query: string;
  count: number;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'icon.search': {
      input: IconSearchQueryInput;
      output: Icon[];
    };
  }
}
