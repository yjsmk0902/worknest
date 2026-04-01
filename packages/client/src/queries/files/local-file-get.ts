import { LocalFile } from '@worknest/client/types';

export type LocalFileGetQueryInput = {
  type: 'local.file.get';
  fileId: string;
  userId: string;
  autoDownload?: boolean;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'local.file.get': {
      input: LocalFileGetQueryInput;
      output: LocalFile | null;
    };
  }
}
