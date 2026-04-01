import { createContext, useContext } from 'react';

import { FieldValue } from '@worknest/core';

interface RecordContext {
  id: string;
  name: string;
  avatar?: string | null;
  fields: Record<string, FieldValue>;
  createdBy: string;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
  databaseId: string;
  canEdit: boolean;
  localRevision: string;
}

export const RecordContext = createContext<RecordContext>({} as RecordContext);

export const useRecord = () => useContext(RecordContext);
