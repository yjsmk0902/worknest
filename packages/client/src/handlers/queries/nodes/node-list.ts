import { sql } from 'kysely';

import { SelectNode } from '@worknest/client/databases';
import { WorkspaceQueryHandlerBase } from '@worknest/client/handlers/queries/workspace-query-handler-base';
import { mapNode } from '@worknest/client/lib';
import {
  buildNodeFiltersQuery,
  buildNodeSortsQuery,
} from '@worknest/client/lib/nodes';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { NodeListQueryInput } from '@worknest/client/queries/nodes/node-list';
import { LocalNode } from '@worknest/client/types/nodes';

export class NodeListQueryHandler
  extends WorkspaceQueryHandlerBase
  implements QueryHandler<NodeListQueryInput>
{
  public async handleQuery(input: NodeListQueryInput): Promise<LocalNode[]> {
    const rows = await this.fetchNodes(input);
    return rows.map(mapNode) as LocalNode[];
  }

  public async checkForChanges(): Promise<
    ChangeCheckResult<NodeListQueryInput>
  > {
    return {
      hasChanges: false,
    };
  }

  private async fetchNodes(input: NodeListQueryInput): Promise<SelectNode[]> {
    const workspace = this.getWorkspace(input.userId);

    const filterQuery = buildNodeFiltersQuery(input.filters);
    const sortQuery = buildNodeSortsQuery(input.sorts);

    let queryString = `SELECT * FROM nodes n WHERE 1=1 ${filterQuery}`;

    if (sortQuery) {
      queryString += ` ORDER BY ${sortQuery}`;
    }

    if (input.limit !== undefined && input.limit > 0) {
      queryString += ` LIMIT ${input.limit}`;
    }

    const query = sql<SelectNode>`${sql.raw(queryString)}`.compile(
      workspace.database
    );

    const result = await workspace.database.executeQuery(query);
    return result.rows;
  }
}
