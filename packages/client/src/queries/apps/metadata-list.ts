import { Metadata } from '@worknest/client/types/apps';

export type MetadataListQueryInput = {
  type: 'metadata.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'metadata.list': {
      input: MetadataListQueryInput;
      output: Metadata[];
    };
  }
}
