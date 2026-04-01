import { LocalDatabaseNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { Database } from '@worknest/ui/components/databases/database';
import { DatabaseViews } from '@worknest/ui/components/databases/database-views';

interface DatabaseContainerProps {
  database: LocalDatabaseNode;
  role: NodeRole;
}

export const DatabaseContainer = ({
  database,
  role,
}: DatabaseContainerProps) => {
  return (
    <Database database={database} role={role}>
      <DatabaseViews />
    </Database>
  );
};
