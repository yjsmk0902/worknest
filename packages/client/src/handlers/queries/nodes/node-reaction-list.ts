import { WorkspaceQueryHandlerBase } from '@worknest/client/handlers/queries/workspace-query-handler-base';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib';
import { NodeReactionListQueryInput } from '@worknest/client/queries/nodes/node-reaction-list';
import { Event } from '@worknest/client/types/events';
import { NodeReaction } from '@worknest/client/types/nodes';

export class NodeReactionsListQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<NodeReactionListQueryInput>
{
  public async handleQuery(
    input: NodeReactionListQueryInput
  ): Promise<NodeReaction[]> {
    return this.fetchNodeReactions(input);
  }

  public async checkForChanges(
    event: Event,
    input: NodeReactionListQueryInput,
    _: NodeReaction[]
  ): Promise<ChangeCheckResult<NodeReactionListQueryInput>> {
    if (
      event.type === 'workspace.deleted' &&
      event.workspace.userId === input.userId
    ) {
      return {
        hasChanges: true,
        result: [],
      };
    }

    if (
      event.type === 'node.reaction.created' &&
      event.workspace.userId === input.userId &&
      event.nodeReaction.nodeId === input.nodeId
    ) {
      const newResult = await this.handleQuery(input);

      return {
        hasChanges: true,
        result: newResult,
      };
    }

    if (
      event.type === 'node.reaction.deleted' &&
      event.workspace.userId === input.userId &&
      event.nodeReaction.nodeId === input.nodeId
    ) {
      const newResult = await this.handleQuery(input);

      return {
        hasChanges: true,
        result: newResult,
      };
    }

    if (
      event.type === 'node.created' &&
      event.workspace.userId === input.userId &&
      event.node.id === input.nodeId
    ) {
      const newResult = await this.handleQuery(input);

      return {
        hasChanges: true,
        result: newResult,
      };
    }

    if (
      event.type === 'node.deleted' &&
      event.workspace.userId === input.userId &&
      event.node.id === input.nodeId
    ) {
      return {
        hasChanges: true,
        result: [],
      };
    }

    return {
      hasChanges: false,
    };
  }

  private async fetchNodeReactions(
    input: NodeReactionListQueryInput
  ): Promise<NodeReaction[]> {
    const workspace = this.getWorkspace(input.userId);

    const reactions = await workspace.database
      .selectFrom('node_reactions')
      .selectAll()
      .where('node_id', '=', input.nodeId)
      .execute();

    return reactions.map((row) => {
      return {
        nodeId: row.node_id,
        collaboratorId: row.collaborator_id,
        rootId: row.root_id,
        reaction: row.reaction,
        createdAt: row.created_at,
      };
    });
  }
}
