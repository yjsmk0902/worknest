import { sql } from 'kysely';

import { SelectNode } from '@worknest/client/databases/workspace';
import { WorkspaceQueryHandlerBase } from '@worknest/client/handlers/queries/workspace-query-handler-base';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib';
import { mapNode } from '@worknest/client/lib/mappers';
import { RecordSearchQueryInput } from '@worknest/client/queries/records/record-search';
import { Event } from '@worknest/client/types/events';
import { LocalRecordNode } from '@worknest/client/types/nodes';

export class RecordSearchQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<RecordSearchQueryInput>
{
  public async handleQuery(
    input: RecordSearchQueryInput
  ): Promise<LocalRecordNode[]> {
    const rows =
      input.searchQuery.length > 0
        ? await this.searchRecords(input)
        : await this.fetchRecords(input);

    return rows.map((row) => mapNode(row) as LocalRecordNode);
  }

  public async checkForChanges(
    event: Event,
    input: RecordSearchQueryInput,
    _: LocalRecordNode[]
  ): Promise<ChangeCheckResult<RecordSearchQueryInput>> {
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
      event.type === 'node.created' &&
      event.workspace.userId === input.userId &&
      event.node.type === 'record' &&
      event.node.databaseId === input.databaseId
    ) {
      const newResult = await this.handleQuery(input);
      return {
        hasChanges: true,
        result: newResult,
      };
    }

    if (
      event.type === 'node.updated' &&
      event.workspace.userId === input.userId &&
      event.node.type === 'record' &&
      event.node.databaseId === input.databaseId
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
      event.node.type === 'record' &&
      event.node.databaseId === input.databaseId
    ) {
      const newResult = await this.handleQuery(input);
      return {
        hasChanges: true,
        result: newResult,
      };
    }

    return {
      hasChanges: false,
    };
  }

  private async searchRecords(
    input: RecordSearchQueryInput
  ): Promise<SelectNode[]> {
    const workspace = this.getWorkspace(input.userId);

    const exclude = input.exclude ?? [];
    const query = sql<SelectNode>`
      SELECT n.*
      FROM nodes n
      JOIN node_names nn ON n.id = nn.id
      WHERE n.type = 'record'
        AND n.parent_id = ${input.databaseId}
        AND en.name MATCH ${input.searchQuery + '*'}
        ${
          exclude.length > 0
            ? sql`AND n.id NOT IN (${sql.join(
                exclude.map((id) => sql`${id}`),
                sql`, `
              )})`
            : sql``
        }
    `.compile(workspace.database);

    const result = await workspace.database.executeQuery(query);
    return result.rows;
  }

  private async fetchRecords(
    input: RecordSearchQueryInput
  ): Promise<SelectNode[]> {
    const workspace = this.getWorkspace(input.userId);

    const exclude = input.exclude ?? [];
    return workspace.database
      .selectFrom('nodes')
      .where('type', '=', 'record')
      .where('parent_id', '=', input.databaseId)
      .where('id', 'not in', exclude)
      .selectAll()
      .execute();
  }
}
