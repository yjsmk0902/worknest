export type SyncNodeTombstonesInput = {
  type: 'node.tombstones';
  rootId: string;
};

export type SyncNodeTombstoneData = {
  id: string;
  rootId: string;
  workspaceId: string;
  deletedBy: string;
  deletedAt: string;
  revision: string;
};

declare module '@worknest/core' {
  interface SynchronizerMap {
    'node.tombstones': {
      input: SyncNodeTombstonesInput;
      data: SyncNodeTombstoneData;
    };
  }
}
