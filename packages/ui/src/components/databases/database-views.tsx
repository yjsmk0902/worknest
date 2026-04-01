import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalDatabaseViewNode } from '@worknest/client/types';
import { View } from '@worknest/ui/components/databases/view';
import { useDatabase } from '@worknest/ui/contexts/database';
import { DatabaseViewsContext } from '@worknest/ui/contexts/database-views';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useMetadata } from '@worknest/ui/hooks/use-metadata';

interface DatabaseViewsProps {
  inline?: boolean;
}

export const DatabaseViews = ({ inline = false }: DatabaseViewsProps) => {
  const workspace = useWorkspace();
  const database = useDatabase();

  const [activeViewId, setActiveViewId] = useMetadata<string>(
    workspace.userId,
    `${database.id}.activeViewId`
  );

  const databaseViewListQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.type, 'database_view'))
        .where(({ nodes }) => eq(nodes.parentId, database.id))
        .orderBy(
          ({ nodes }) => (nodes as unknown as LocalDatabaseViewNode).index,
          'asc'
        ),
    [workspace.userId, database.id]
  );

  const views = databaseViewListQuery.data.map(
    (node) => node as LocalDatabaseViewNode
  );
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];

  return (
    <DatabaseViewsContext.Provider
      value={{
        views,
        activeViewId: activeView?.id ?? '',
        onActiveViewChange: setActiveViewId,
        inline,
      }}
    >
      {activeView && <View view={activeView} />}
    </DatabaseViewsContext.Provider>
  );
};
