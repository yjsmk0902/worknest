import { DocumentUpdate } from '@worknest/client/types/documents';

export type DocumentUpdatesListQueryInput = {
  type: 'document.updates.list';
  documentId: string;
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'document.updates.list': {
      input: DocumentUpdatesListQueryInput;
      output: DocumentUpdate[];
    };
  }
}
