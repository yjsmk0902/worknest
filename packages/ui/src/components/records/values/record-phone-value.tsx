import { PhoneFieldAttributes, StringFieldValue } from '@worknest/core';
import { Input } from '@worknest/ui/components/ui/input';
import { useRecord } from '@worknest/ui/contexts/record';
import { useRecordField } from '@worknest/ui/hooks/use-record-field';

interface RecordPhoneValueProps {
  field: PhoneFieldAttributes;
  readOnly?: boolean;
}

export const RecordPhoneValue = ({
  field,
  readOnly,
}: RecordPhoneValueProps) => {
  const record = useRecord();
  const { value, setValue, clearValue } = useRecordField<StringFieldValue>({
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
            type: 'string',
            value: newValue,
          });
        }
      }}
      className="flex h-full w-full cursor-pointer flex-row items-center gap-1 p-0 border-none text-sm focus-visible:cursor-text"
    />
  );
};
