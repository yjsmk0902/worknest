import { LocalSpaceNode } from '@worknest/client/types';
import { Tab } from '@worknest/ui/components/layouts/tabs/tab';

interface SpaceTabProps {
  space: LocalSpaceNode;
}

export const SpaceTab = ({ space }: SpaceTabProps) => {
  return <Tab id={space.id} avatar={space.avatar} name={space.name} />;
};
