import { EventBus } from '@worknest/client/lib';
import { MutationInput, MutationResult } from '@worknest/client/mutations';
import { QueryInput, QueryMap } from '@worknest/client/queries';
import { AppInitOutput, TempFile } from '@worknest/client/types';

interface SaveDialogOptions {
  name: string;
}

export interface WorknestWindowApi {
  init: () => Promise<AppInitOutput>;
  reset: () => Promise<void>;
  executeMutation: <T extends MutationInput>(
    input: T
  ) => Promise<MutationResult<T>>;
  executeQuery: <T extends QueryInput>(
    input: T
  ) => Promise<QueryMap[T['type']]['output']>;
  executeQueryAndSubscribe: <T extends QueryInput>(
    key: string,
    input: T
  ) => Promise<QueryMap[T['type']]['output']>;
  unsubscribeQuery: (key: string) => Promise<void>;
  saveTempFile: (file: File) => Promise<TempFile>;
  openExternalUrl: (url: string) => Promise<void>;
  showItemInFolder: (path: string) => Promise<void>;
  showFileSaveDialog: (
    options: SaveDialogOptions
  ) => Promise<string | undefined>;
}

declare global {
  interface Window {
    worknest: WorknestWindowApi;
    eventBus: EventBus;
  }
}
