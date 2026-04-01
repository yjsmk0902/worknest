export type TabDeleteMutationInput = {
  type: 'tab.delete';
  id: string;
};

export type TabDeleteMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'tab.delete': {
      input: TabDeleteMutationInput;
      output: TabDeleteMutationOutput;
    };
  }
}
