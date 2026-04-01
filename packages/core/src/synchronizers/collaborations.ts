import { NodeRole } from '@worknest/core/registry/nodes/core';

export type SyncCollaborationsInput = {
  type: 'collaborations';
};

export type SyncCollaborationData = {
  collaboratorId: string;
  nodeId: string;
  workspaceId: string;
  role: NodeRole;
  createdAt: string;
  createdBy: string;
  updatedAt: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  revision: string;
};

declare module '@worknest/core' {
  interface SynchronizerMap {
    collaborations: {
      input: SyncCollaborationsInput;
      data: SyncCollaborationData;
    };
  }
}
