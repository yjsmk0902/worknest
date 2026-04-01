import { Fragment } from 'react';

import { ViewFilters } from '@worknest/ui/components/databases/search/view-filters';
import { ViewSorts } from '@worknest/ui/components/databases/search/view-sorts';
import { Separator } from '@worknest/ui/components/ui/separator';
import { useDatabaseView } from '@worknest/ui/contexts/database-view';

export const ViewSearchBar = () => {
  const view = useDatabaseView();

  if (!view.isSearchBarOpened) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-row items-center gap-2">
      {view.sorts.length > 0 && (
        <Fragment>
          <ViewSorts />
          <Separator orientation="vertical" className="mx-1 h-4" />
        </Fragment>
      )}
      <ViewFilters />
    </div>
  );
};
