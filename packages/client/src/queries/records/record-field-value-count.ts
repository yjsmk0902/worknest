import { DatabaseViewFilterAttributes } from '@worknest/core';

export type RecordFieldValueCountQueryInput = {
  type: 'record.field.value.count';
  databaseId: string;
  filters: DatabaseViewFilterAttributes[];
  fieldId: string;
  userId: string;
};

export type RecordFieldValueCount = {
  value: string;
  count: number;
};

export type RecordFieldValueCountQueryOutput = {
  values: RecordFieldValueCount[];
  noValueCount: number;
};

declare module '@worknest/client/queries' {
  interface QueryMap {
    'record.field.value.count': {
      input: RecordFieldValueCountQueryInput;
      output: RecordFieldValueCountQueryOutput;
    };
  }
}
