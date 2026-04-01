import { Download } from '@worknest/client/types/files';

export type DownloadListQueryInput = {
  type: 'download.list';
  userId: string;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'download.list': {
      input: DownloadListQueryInput;
      output: Download[];
    };
  }
}
