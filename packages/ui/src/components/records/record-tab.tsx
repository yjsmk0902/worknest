import { LocalRecordNode } from '@worknest/client/types';
import { Tab } from '@worknest/ui/components/layouts/tabs/tab';

interface RecordTabProps {
  record: LocalRecordNode;
}

export const RecordTab = ({ record }: RecordTabProps) => {
  const name = record.name && record.name.length > 0 ? record.name : 'Untitled';
  return <Tab id={record.id} avatar={record.avatar} name={name} />;
};
