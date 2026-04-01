import { TempFile } from '@worknest/client/types';

export type TempFileListQueryInput = {
  type: 'temp.file.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'temp.file.list': {
      input: TempFileListQueryInput;
      output: TempFile[];
    };
  }
}
