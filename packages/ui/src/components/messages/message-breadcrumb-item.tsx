import { LocalMessageNode } from '@worknest/client/types';
import { BreadcrumbItem } from '@worknest/ui/components/layouts/containers/breadcrumb-item';
import { defaultIcons } from '@worknest/ui/lib/assets';

interface MessageBreadcrumbItemProps {
  message: LocalMessageNode;
}

export const MessageBreadcrumbItem = ({
  message: _,
}: MessageBreadcrumbItemProps) => {
  return (
    <BreadcrumbItem id="message" avatar={defaultIcons.message} name="Message" />
  );
};
