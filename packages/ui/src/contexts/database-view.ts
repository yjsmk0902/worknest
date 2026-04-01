import { createContext, useContext } from 'react';

import { ViewField } from '@worknest/client/types';
import {
  DatabaseViewFilterAttributes,
  DatabaseViewSortAttributes,
  DatabaseViewLayout,
  SortDirection,
} from '@worknest/core';

interface DatabaseViewContext {
  id: string;
  name: string;
  avatar: string | null | undefined;
  layout: DatabaseViewLayout;
  fields: ViewField[];
  filters: DatabaseViewFilterAttributes[];
  sorts: DatabaseViewSortAttributes[];
  groupBy: string | null | undefined;
  nameWidth: number;
  isSearchBarOpened: boolean;
  isSortsOpened: boolean;
  initFieldFilter: (fieldId: string) => void;
  initFieldSort: (fieldId: string, direction: SortDirection) => void;
  isFieldFilterOpened: (fieldId: string) => boolean;
  openSearchBar: () => void;
  closeSearchBar: () => void;
  openSorts: () => void;
  closeSorts: () => void;
  openFieldFilter: (fieldId: string) => void;
  closeFieldFilter: (fieldId: string) => void;
  createRecord: (filters?: DatabaseViewFilterAttributes[]) => void;
}

export const DatabaseViewContext = createContext<DatabaseViewContext>(
  {} as DatabaseViewContext
);

export const useDatabaseView = () => useContext(DatabaseViewContext);
