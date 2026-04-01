import { useCallback } from 'react';

import { FieldType } from '@worknest/core';
import { FieldCreatePopover } from '@worknest/ui/components/databases/fields/field-create-popover';
import { FieldSelect } from '@worknest/ui/components/databases/fields/field-select';
import { Button } from '@worknest/ui/components/ui/button';
import { useDatabase } from '@worknest/ui/contexts/database';
import { useDatabaseView } from '@worknest/ui/contexts/database-view';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

const calendarGroupFields: FieldType[] = ['date', 'created_at', 'updated_at'];

export const CalendarViewNoGroup = () => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();

  const possibleGroupByFields = database.fields.filter((field) =>
    calendarGroupFields.includes(field.type)
  );

  const handleFieldSelect = useCallback(
    (fieldId: string) => {
      workspace.collections.nodes.update(view.id, (draft) => {
        if (draft.type !== 'database_view') {
          return;
        }

        draft.groupBy = fieldId;
      });
    },
    [view.id]
  );

  return (
    <div className="flex w-full flex-col items-center justify-center pt-20">
      {possibleGroupByFields.length > 0 ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm">
            Please select a group you want to group the calendar by.
          </p>
          <div className="w-90">
            <FieldSelect
              fields={possibleGroupByFields}
              value={view.groupBy ?? null}
              onChange={handleFieldSelect}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm">
            There is no field that can be used to group the calendar by. Please
            create a new field that can be used to group the calendar by.
          </p>
          <FieldCreatePopover
            button={
              <Button variant="outline" size="sm">
                Add field
              </Button>
            }
            types={calendarGroupFields}
            onSuccess={handleFieldSelect}
          />
        </div>
      )}
    </div>
  );
};
