import { Plus } from 'lucide-react';

import { FieldCreatePopover } from '@worknest/ui/components/databases/fields/field-create-popover';
import { TableViewFieldHeader } from '@worknest/ui/components/databases/tables/table-view-field-header';
import { TableViewNameHeader } from '@worknest/ui/components/databases/tables/table-view-name-header';
import { useDatabase } from '@worknest/ui/contexts/database';
import { useDatabaseView } from '@worknest/ui/contexts/database-view';

export const TableViewHeader = () => {
  const database = useDatabase();
  const view = useDatabaseView();

  return (
    <div className="flex flex-row items-center gap-0.5">
      <div style={{ width: '30px', minWidth: '30px' }} />
      <TableViewNameHeader />
      {view.fields.map((field) => {
        return <TableViewFieldHeader viewField={field} key={field.field.id} />;
      })}
      {database.canEdit && !database.isLocked && (
        <FieldCreatePopover
          button={<Plus className="ml-2 size-4 cursor-pointer" />}
        />
      )}
    </div>
  );
};
