import { Upload } from '@worknest/client/types/files';

export type UploadListQueryInput = {
  type: 'upload.list';
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'upload.list': {
      input: UploadListQueryInput;
      output: Upload[];
    };
  }
}
