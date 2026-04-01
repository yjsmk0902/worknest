import { Tab } from '@worknest/client/types/apps';

export type TabsListQueryInput = {
  type: 'tabs.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'tabs.list': {
      input: TabsListQueryInput;
      output: Tab[];
    };
  }
}
