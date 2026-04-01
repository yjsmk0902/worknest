import {
  SynchronizerOutputMessage,
  SyncNodeUpdatesInput,
  SyncNodeUpdateData,
} from '@worknest/core';
import { encodeState } from '@worknest/crdt';
import { database } from '@worknest/server/data/database';
import { SelectNodeUpdate } from '@worknest/server/data/schema';
import { createLogger } from '@worknest/server/lib/logger';
import { BaseSynchronizer } from '@worknest/server/synchronizers/base';
import { Event } from '@worknest/server/types/events';

const logger = createLogger('node-update-synchronizer');

export class NodeUpdatesSynchronizer extends BaseSynchronizer<SyncNodeUpdatesInput> {
  public async fetchData(): Promise<SynchronizerOutputMessage<SyncNodeUpdatesInput> | null> {
    const nodeUpdates = await this.fetchNodeUpdates();
    if (nodeUpdates.length === 0) {
      return null;
    }

    return this.buildMessage(nodeUpdates);
  }

  public async fetchDataFromEvent(
    event: Event
  ): Promise<SynchronizerOutputMessage<SyncNodeUpdatesInput> | null> {
    if (!this.shouldFetch(event)) {
      return null;
    }

    const nodeUpdates = await this.fetchNodeUpdates();
    if (nodeUpdates.length === 0) {
      return null;
    }

    return this.buildMessage(nodeUpdates);
  }

  private async fetchNodeUpdates() {
    if (this.status === 'fetching') {
      return [];
    }

    this.status = 'fetching';

    try {
      const nodesUpdates = await database
        .selectFrom('node_updates')
        .selectAll()
        .where('root_id', '=', this.input.rootId)
        .where('revision', '>', this.cursor)
        .orderBy('revision', 'asc')
        .limit(100)
        .execute();

      return nodesUpdates;
    } catch (error) {
      logger.error(error, 'Error fetching node updates for sync');
    } finally {
      this.status = 'pending';
    }

    return [];
  }

  private buildMessage(
    unsyncedNodeUpdates: SelectNodeUpdate[]
  ): SynchronizerOutputMessage<SyncNodeUpdatesInput> {
    const items: SyncNodeUpdateData[] = unsyncedNodeUpdates.map(
      (nodeUpdate) => {
        return {
          id: nodeUpdate.id,
          nodeId: nodeUpdate.node_id,
          rootId: nodeUpdate.root_id,
          workspaceId: nodeUpdate.workspace_id,
          revision: nodeUpdate.revision.toString(),
          data: encodeState(nodeUpdate.data),
          createdAt: nodeUpdate.created_at.toISOString(),
          createdBy: nodeUpdate.created_by,
          mergedUpdates: nodeUpdate.merged_updates,
        };
      }
    );

    return {
      type: 'synchronizer.output',
      userId: this.user.userId,
      id: this.id,
      items: items.map((item) => ({
        cursor: item.revision,
        data: item,
      })),
    };
  }

  private shouldFetch(event: Event) {
    if (event.type === 'node.created' && event.rootId === this.input.rootId) {
      return true;
    }

    if (event.type === 'node.updated' && event.rootId === this.input.rootId) {
      return true;
    }

    return false;
  }
}
