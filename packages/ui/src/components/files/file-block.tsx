import { eq, useLiveQuery } from '@tanstack/react-db';

import { LocalFileNode } from '@worknest/client/types';
import { FileIcon } from '@worknest/ui/components/files/file-icon';
import { FilePreview } from '@worknest/ui/components/files/file-preview';
import { Link } from '@worknest/ui/components/ui/link';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { canPreviewFile } from '@worknest/ui/lib/files';

interface FileBlockProps {
  id: string;
}

export const FileBlock = ({ id }: FileBlockProps) => {
  const workspace = useWorkspace();

  const fileGetQuery = useLiveQuery(
    (q) =>
      q
        .from({ nodes: workspace.collections.nodes })
        .where(({ nodes }) => eq(nodes.id, id))
        .findOne(),
    [workspace.userId, id]
  );

  if (
    fileGetQuery.isLoading ||
    !fileGetQuery.data ||
    fileGetQuery.data.type !== 'file'
  ) {
    return null;
  }

  const file = fileGetQuery.data as LocalFileNode;
  const canPreview = canPreviewFile(file.subtype);

  return (
    <Link
      from="/workspace/$userId/$nodeId"
      to="modal/$modalNodeId"
      params={{ modalNodeId: id }}
    >
      {canPreview ? (
        <div className="flex h-72 max-h-72 max-w-lg w-full cursor-pointer overflow-hidden rounded-md p-2 hover:bg-muted/50 items-center justify-center">
          <FilePreview file={file} />
        </div>
      ) : (
        <div className="flex flex-row gap-4 items-center w-full cursor-pointer overflow-hidden rounded-md p-2 pl-0 hover:bg-accent">
          <FileIcon mimeType={file.mimeType} className="size-10" />
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">{file.mimeType}</div>
          </div>
        </div>
      )}
    </Link>
  );
};
