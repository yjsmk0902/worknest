import { LocalRecordNode } from '@worknest/client/types/nodes';

export type RecordSearchQueryInput = {
  type: 'record.search';
  searchQuery: string;
  userId: string;
  databaseId: string;
  exclude?: string[];
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'record.search': {
      input: RecordSearchQueryInput;
      output: LocalRecordNode[];
    };
  }
}
