import { LocalDatabaseNode } from '@worknest/client/types';
import { Tab } from '@worknest/ui/components/layouts/tabs/tab';

interface DatabaseTabProps {
  database: LocalDatabaseNode;
}

export const DatabaseTab = ({ database }: DatabaseTabProps) => {
  const name =
    database.name && database.name.length > 0 ? database.name : 'Untitled';

  return <Tab id={database.id} avatar={database.avatar} name={name} />;
};
