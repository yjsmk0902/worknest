import { DownloadStatus, LocalFileNode } from '@worknest/client/types';
import { FileStatus } from '@worknest/core';
import { FileDownloadProgress } from '@worknest/ui/components/files/file-download-progress';
import { FileNoPreview } from '@worknest/ui/components/files/file-no-preview';
import { FileNotUploaded } from '@worknest/ui/components/files/file-not-uploaded';
import { FilePreviewAudio } from '@worknest/ui/components/files/previews/file-preview-audio';
import { FilePreviewImage } from '@worknest/ui/components/files/previews/file-preview-image';
import { FilePreviewVideo } from '@worknest/ui/components/files/previews/file-preview-video';
import { useWorkspace } from '@worknest/ui/contexts/workspace';
import { useLiveQuery } from '@worknest/ui/hooks/use-live-query';

interface FilePreviewProps {
  file: LocalFileNode;
}

export const FilePreview = ({ file }: FilePreviewProps) => {
  const workspace = useWorkspace();

  const isReady = file.status === FileStatus.Ready;
  const localFileQuery = useLiveQuery({
    type: 'local.file.get',
    fileId: file.id,
    userId: workspace.userId,
    autoDownload: isReady,
  });

  if (localFileQuery.isPending) {
    return null;
  }

  const localFile = localFileQuery.data;
  if (!localFile) {
    if (!isReady) {
      return <FileNotUploaded mimeType={file.mimeType} />;
    }

    return <FileNoPreview mimeType={file.mimeType} />;
  }

  if (localFile.downloadStatus !== DownloadStatus.Completed) {
    return <FileDownloadProgress progress={localFile.downloadProgress} />;
  }

  if (localFile.downloadStatus === DownloadStatus.Completed && localFile.url) {
    if (file.subtype === 'image') {
      return <FilePreviewImage url={localFile.url} name={file.name} />;
    }

    if (file.subtype === 'video') {
      return <FilePreviewVideo url={localFile.url} />;
    }

    if (file.subtype === 'audio') {
      return <FilePreviewAudio url={localFile.url} name={file.name} />;
    }
  }

  return <FileNoPreview mimeType={file.mimeType} />;
};
