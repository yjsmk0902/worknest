import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalDatabaseNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { Database } from '@worknest/ui/components/databases/database';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

interface RecordDatabaseProps {
  id: string;
  role: NodeRole;
  children: React.ReactNode;
}

export const RecordDatabase = ({ id, role, children }: RecordDatabaseProps) => {
  const workspace = useWorkspace();

  const databaseGetQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, id))
        .findOne(),
    [workspace.userId, id]
  );

  if (databaseGetQuery.isLoading) {
    return null;
  }

  if (!databaseGetQuery.data || databaseGetQuery.data.type !== 'database') {
    return null;
  }

  const database = databaseGetQuery.data as LocalDatabaseNode;
  return (
    <Database database={database} role={role}>
      {children}
    </Database>
  );
};
