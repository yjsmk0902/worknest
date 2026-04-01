import { LocalNode } from '@worknest/client/types';
import { NodeRole } from '@worknest/core';
import { ChannelSettings } from '@worknest/ui/components/channels/channel-settings';
import { NodeCollaboratorsPopover } from '@worknest/ui/components/collaborators/node-collaborators-popover';
import { DatabaseSettings } from '@worknest/ui/components/databases/database-settings';
import { FileSettings } from '@worknest/ui/components/files/file-settings';
import { FolderSettings } from '@worknest/ui/components/folders/folder-settings';
import { PageSettings } from '@worknest/ui/components/pages/page-settings';
import { RecordSettings } from '@worknest/ui/components/records/record-settings';

interface NodeSettingsProps {
  node: LocalNode;
  role: NodeRole;
}

export const NodeSettings = ({ node, role }: NodeSettingsProps) => {
  if (node.type === 'channel') {
    return <ChannelSettings channel={node} role={role} />;
  }

  if (node.type === 'chat') {
    return <NodeCollaboratorsPopover node={node} nodes={[node]} role={role} />;
  }

  if (node.type === 'database') {
    return <DatabaseSettings database={node} role={role} />;
  }

  if (node.type === 'folder') {
    return <FolderSettings folder={node} role={role} />;
  }

  if (node.type === 'file') {
    return <FileSettings file={node} role={role} />;
  }

  if (node.type === 'page') {
    return <PageSettings page={node} role={role} />;
  }

  if (node.type === 'record') {
    return <RecordSettings record={node} role={role} />;
  }

  return null;
};
