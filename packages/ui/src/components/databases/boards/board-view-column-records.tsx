import { useMemo } from 'react';

import { extractNodeRole } from '@worknest/core';
import { BoardViewRecordCard } from '@worknest/ui/components/databases/boards/board-view-record-card';
import { BoardViewRecordCreateCard } from '@worknest/ui/components/databases/boards/board-view-record-create-card';
import { RecordProvider } from '@worknest/ui/components/records/record-provider';
import { useBoardView } from '@worknest/ui/contexts/board-view';
import { useDatabase } from '@worknest/ui/contexts/database';
import { useDatabaseView } from '@worknest/ui/contexts/database-view';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useRecordsQuery } from '@worknest/ui/hooks/use-records-query';

export const BoardViewColumnRecords = () => {
  const workspace = useWorkspace();
  const database = useDatabase();
  const view = useDatabaseView();
  const boardView = useBoardView();

  const filters = useMemo(
    () => [...view.filters, boardView.filter],
    [view.filters, boardView.filter]
  );

  const { data } = useRecordsQuery(filters, view.sorts);
  const records = data;

  return (
    <div className="mt-3 flex flex-col gap-2">
      {records.map((record) => {
        const role = extractNodeRole(record, workspace.userId) ?? database.role;

        return (
          <RecordProvider key={record.id} record={record} role={role}>
            <BoardViewRecordCard />
          </RecordProvider>
        );
      })}
      <BoardViewRecordCreateCard filters={filters} />
    </div>
  );
};
