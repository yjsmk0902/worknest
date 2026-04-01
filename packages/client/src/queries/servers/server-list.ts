import { Server } from '@worknest/client/types';

export type ServerListQueryInput = {
  type: 'server.list';
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'server.list': {
      input: ServerListQueryInput;
      output: Server[];
    };
  }
}
