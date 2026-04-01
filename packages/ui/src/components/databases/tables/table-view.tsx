import { Fragment } from 'react';

import { ViewFilterButton } from '@worknest/ui/components/databases/search/view-filter-button';
import { ViewSearchBar } from '@worknest/ui/components/databases/search/view-search-bar';
import { ViewSortButton } from '@worknest/ui/components/databases/search/view-sort-button';
import { TableViewBody } from '@worknest/ui/components/databases/tables/table-view-body';
import { TableViewHeader } from '@worknest/ui/components/databases/tables/table-view-header';
import { TableViewRecordCreateRow } from '@worknest/ui/components/databases/tables/table-view-record-create-row';
import { TableViewSettings } from '@worknest/ui/components/databases/tables/table-view-settings';
import { ViewFullscreenButton } from '@worknest/ui/components/databases/view-fullscreen-button';
import { ViewTabs } from '@worknest/ui/components/databases/view-tabs';

export const TableView = () => {
  return (
    <Fragment>
      <div className="flex flex-row justify-between border-b">
        <ViewTabs />
        <div className="invisible flex flex-row items-center justify-end group-hover/database:visible">
          <ViewFullscreenButton />
          <TableViewSettings />
          <ViewSortButton />
          <ViewFilterButton />
        </div>
      </div>
      <ViewSearchBar />
      <div className="mt-2 w-full min-w-full max-w-full overflow-auto pr-5">
        <TableViewHeader />
        <TableViewBody />
        <TableViewRecordCreateRow />
      </div>
    </Fragment>
  );
};
