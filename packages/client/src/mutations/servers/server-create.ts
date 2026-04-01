import { Server } from '@worknest/client/types/servers';

export type ServerCreateMutationInput = {
  type: 'server.create';
  url: string;
};

export type ServerCreateMutationOutput = {
  server: Server;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'server.create': {
      input: ServerCreateMutationInput;
      output: ServerCreateMutationOutput;
    };
  }
}
