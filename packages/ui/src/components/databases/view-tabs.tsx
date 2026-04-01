import { ViewCreateButton } from '@worknest/ui/components/databases/view-create-button';
import { ViewTab } from '@worknest/ui/components/databases/view-tab';
import { useDatabase } from '@worknest/ui/contexts/database';
import { useDatabaseViews } from '@worknest/ui/contexts/database-views';

export const ViewTabs = () => {
  const database = useDatabase();
  const databaseViews = useDatabaseViews();

  return (
    <div className="flex flex-row items-center gap-3">
      {databaseViews.views.map((view) => (
        <ViewTab
          key={view.id}
          view={view}
          isActive={view.id === databaseViews.activeViewId}
          onClick={() => databaseViews.onActiveViewChange(view.id)}
        />
      ))}
      {database.canEdit && !database.isLocked && <ViewCreateButton />}
    </div>
  );
};
