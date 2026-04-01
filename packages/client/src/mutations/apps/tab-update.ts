export type TabUpdateMutationInput = {
  type: 'tab.update';
  id: string;
  location?: string;
  index?: string;
  lastActiveAt?: string;
};

export type TabUpdateMutationOutput = {
  success: boolean;
};

declare module '@worknest/client/mutations' {
  interface MutationMap {
    'tab.update': {
      input: TabUpdateMutationInput;
      output: TabUpdateMutationOutput;
    };
  }
}
