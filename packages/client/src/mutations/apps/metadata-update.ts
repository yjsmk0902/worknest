export type MetadataUpdateMutationInput = {
  type: 'metadata.update';
  namespace: string;
  key: string;
  value: string;
};

export type MetadataUpdateMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'metadata.update': {
      input: MetadataUpdateMutationInput;
      output: MetadataUpdateMutationOutput;
    };
  }
}
