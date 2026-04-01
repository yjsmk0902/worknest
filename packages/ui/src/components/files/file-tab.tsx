import { LocalFileNode } from '@worknest/client/types';
import { FileThumbnail } from '@worknest/ui/components/files/file-thumbnail';

interface FileTabProps {
  userId: string;
  file: LocalFileNode;
}

export const FileTab = ({ userId, file }: FileTabProps) => {
  const name = file.name && file.name.length > 0 ? file.name : 'Untitled';

  return (
    <div className="flex items-center space-x-2">
      <FileThumbnail
        userId={userId}
        file={file}
        className="size-4 rounded object-contain"
      />
      <span>{name}</span>
    </div>
  );
};
