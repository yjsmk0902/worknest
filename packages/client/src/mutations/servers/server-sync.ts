export type ServerSyncMutationInput = {
  type: 'server.sync';
  domain: string;
};

export type ServerSyncMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'server.sync': {
      input: ServerSyncMutationInput;
      output: ServerSyncMutationOutput;
    };
  }
}
