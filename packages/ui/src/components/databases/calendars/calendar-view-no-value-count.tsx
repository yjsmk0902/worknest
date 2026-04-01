import { CircleDashed } from 'lucide-react';

import { DatabaseViewFilterAttributes, FieldAttributes } from '@worknest/core';
import { CalendarViewNoValueList } from '@worknest/ui/components/databases/calendars/calendar-view-no-value-list';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@worknest/ui/components/ui/dialog';
import {
  ScrollArea,
  ScrollViewport,
  ScrollBar,
} from '@worknest/ui/components/ui/scroll-area';
import { useDatabase } from '@worknest/ui/contexts/database';
import { useDatabaseView } from '@worknest/ui/contexts/database-view';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useLiveQuery } from '@worknest/ui/hooks/use-live-query';

interface CalendarViewNoValueCountProps {
  field: FieldAttributes;
}

export const CalendarViewNoValueCount = ({
  field,
}: CalendarViewNoValueCountProps) => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();

  const filters: DatabaseViewFilterAttributes[] = [
    ...view.filters,
    {
      id: 'no_value',
      type: 'field',
      fieldId: field.id,
      operator: 'is_empty',
    },
  ];

  const noValueCountQuery = useLiveQuery({
    type: 'record.field.value.count',
    databaseId: database.id,
    filters: filters,
    fieldId: field.id,
    userId: workspace.userId,
  });

  const noValueCount = noValueCountQuery.data?.noValueCount ?? 0;
  if (noValueCount === 0) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className="flex flex-row items-center gap-1 text-sm mr-2 hover:bg-muted hover:cursor-pointer rounded-md p-1"
          role="presentation"
        >
          <CircleDashed className="size-4" />
          <p>No {field.name}</p>
          <p>({noValueCount.toLocaleString()})</p>
        </div>
      </DialogTrigger>
      <DialogContent className="w-128 min-w-128 min-h-40 overflow-hidden p-4">
        <DialogHeader>
          <DialogTitle>{view.name}</DialogTitle>
          <DialogDescription>
            Record with no {field.name} value ({noValueCount.toLocaleString()})
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96">
          <ScrollViewport>
            <div className="max-h-none overflow-hidden pr-4">
              <CalendarViewNoValueList filters={filters} field={field} />
            </div>
          </ScrollViewport>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
