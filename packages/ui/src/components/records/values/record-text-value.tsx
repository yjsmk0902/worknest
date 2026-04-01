import { TextFieldAttributes, TextFieldValue } from '@worknest/core';
import { Input } from '@worknest/ui/components/ui/input';
import { useRecord } from '@worknest/ui/contexts/record';
import { useRecordField } from '@worknest/ui/hooks/use-record-field';

interface RecordTextValueProps {
  field: TextFieldAttributes;
  readOnly?: boolean;
}

export const RecordTextValue = ({ field, readOnly }: RecordTextValueProps) => {
  const record = useRecord();
  const { value, setValue, clearValue } = useRecordField<TextFieldValue>({
    field,
  });

  return (
    <Input
      value={value?.value ?? ''}
      readOnly={!record.canEdit || readOnly}
      onChange={(e) => {
        const newValue = e.target.value;
        if (!record.canEdit || readOnly) return;

        if (newValue === value?.value) {
          return;
        }

        if (newValue === null || newValue === '') {
          clearValue();
        } else {
          setValue({
            type: 'text',
            value: newValue,
          });
        }
      }}
      className="flex h-full w-full cursor-pointer flex-row items-center gap-1 border-none p-0 text-sm shadow-none focus-visible:cursor-text"
    />
  );
};
