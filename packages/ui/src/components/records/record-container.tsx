import { LocalRecordNode } from '@worknest/client/types';
import { NodeRole, hasNodeRole } from '@worknest/core';
import { Document } from '@worknest/ui/components/documents/document';
import { RecordAttributes } from '@worknest/ui/components/records/record-attributes';
import { RecordDatabase } from '@worknest/ui/components/records/record-database';
import { RecordProvider } from '@worknest/ui/components/records/record-provider';
import { Separator } from '@worknest/ui/components/ui/separator';
import { useWorkspace } from '@worknest/ui/contexts/workspace';

interface RecordContainerProps {
  record: LocalRecordNode;
  role: NodeRole;
}

export const RecordContainer = ({ record, role }: RecordContainerProps) => {
  const workspace = useWorkspace();

  const canEdit =
    record.createdBy === workspace.userId || hasNodeRole(role, 'editor');
  return (
    <RecordDatabase id={record.databaseId} role={role}>
      <RecordProvider record={record} role={role}>
        <RecordAttributes />
      </RecordProvider>
      <Separator className="my-4 w-full" />
      <Document node={record} canEdit={canEdit} autoFocus={false} />
    </RecordDatabase>
  );
};
