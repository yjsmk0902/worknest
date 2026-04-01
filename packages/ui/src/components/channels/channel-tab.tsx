import { LocalChannelNode } from '@worknest/client/types';
import { Tab } from '@worknest/ui/components/layouts/tabs/tab';

interface ChannelTabProps {
  channel: LocalChannelNode;
}

export const ChannelTab = ({ channel }: ChannelTabProps) => {
  const name =
    channel.name && channel.name.length > 0 ? channel.name : 'Unnamed';

  return <Tab id={channel.id} avatar={channel.avatar} name={name} />;
};
