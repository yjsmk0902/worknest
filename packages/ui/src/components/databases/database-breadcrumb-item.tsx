import { LocalDatabaseNode } from '@worknest/client/types';
import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';

interface DatabaseBreadcrumbItemProps {
  database: LocalDatabaseNode;
}

export const DatabaseBreadcrumbItem = ({
  database,
}: DatabaseBreadcrumbItemProps) => {
  return (
    <BreadcrumbItem
      id={database.id}
      avatar={database.avatar}
      name={database.name}
    />
  );
};
