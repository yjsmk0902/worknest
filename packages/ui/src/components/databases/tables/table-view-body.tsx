import { InView } from 'react-intersection-observer';

import { TableViewEmptyPlaceholder } from '@worknest/ui/components/databases/tables/table-view-empty-placeholder';
import { TableViewRow } from '@worknest/ui/components/databases/tables/table-view-row';
import { useDatabaseView } from '@worknest/ui/contexts/database-view';
import { useRecordsQuery } from '@worknest/ui/hooks/use-records-query';

export const TableViewBody = () => {
  const view = useDatabaseView();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useRecordsQuery(view.filters, view.sorts);

  const records = data;

  return (
    <div className="border-t">
      {records.length === 0 && <TableViewEmptyPlaceholder />}
      {records.map((record, index) => (
        <TableViewRow key={record.id} index={index} record={record} />
      ))}
      <InView
        rootMargin="200px"
        onChange={(inView) => {
          if (inView && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
      ></InView>
    </div>
  );
};
