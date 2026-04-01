import { DocumentState } from '@worknest/client/types/documents';

export type DocumentStateGetQueryInput = {
  type: 'document.state.get';
  documentId: string;
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'document.state.get': {
      input: DocumentStateGetQueryInput;
      output: DocumentState | null;
    };
  }
}
