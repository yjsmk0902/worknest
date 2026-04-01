import { Document } from '@worknest/client/types/documents';

export type DocumentGetQueryInput = {
  type: 'document.get';
  documentId: string;
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'document.get': {
      input: DocumentGetQueryInput;
      output: Document | null;
    };
  }
}
