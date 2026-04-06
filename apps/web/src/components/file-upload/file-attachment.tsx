import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  Download,
  Trash2,
  Image,
  FileText,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
  File,
  X,
} from 'lucide-react';
import { Button, Progress } from '@worknest/ui';
import type { FileOutput } from '@worknest/shared/schemas/files';
import { useFileUpload } from '../../hooks/use-file-upload';

// ── MIME type icon mapping ──────────────────────────────────────────────

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))
    return <Image className="w-5 h-5 text-green-500" />;
  if (mimeType === 'application/pdf')
    return <FileText className="w-5 h-5 text-red-500" />;
  if (mimeType.startsWith('text/') || mimeType === 'application/json')
    return <FileCode className="w-5 h-5 text-blue-500" />;
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-tar' ||
    mimeType === 'application/gzip'
  )
    return <FileArchive className="w-5 h-5 text-yellow-500" />;
  if (mimeType.startsWith('video/'))
    return <FileVideo className="w-5 h-5 text-purple-500" />;
  if (mimeType.startsWith('audio/'))
    return <FileAudio className="w-5 h-5 text-pink-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── File Card ───────────────────────────────────────────────────────────

interface FileCardProps {
  file: FileOutput;
  onDelete?: (fileId: string) => void;
}

function FileCard({ file, onDelete }: FileCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-card hover:border-border/80 hover:shadow-sm min-w-[200px] max-w-[280px]">
      <div className="bg-muted rounded-md p-1.5 shrink-0">
        {getFileIcon(file.mimeType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate max-w-[200px]">
          {file.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={() => {
            window.open(`/api/v1/files/${file.id}/download`, '_blank');
          }}
          aria-label={`Download ${file.name}`}
        >
          <Download size={16} />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(file.id)}
            aria-label={`Delete ${file.name}`}
          >
            <Trash2 size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Uploading Card ──────────────────────────────────────────────────────

interface UploadingCardProps {
  fileName: string;
  progress: number;
  onCancel?: () => void;
}

function UploadingCard({ fileName, progress, onCancel }: UploadingCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-md bg-card min-w-[200px] max-w-[280px]">
      <div className="bg-muted rounded-md p-1.5 shrink-0">
        <File className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground">{progress}%</span>
        </div>
      </div>
      {onCancel && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 shrink-0"
          onClick={onCancel}
          aria-label="Cancel upload"
        >
          <X size={16} />
        </Button>
      )}
    </div>
  );
}

// ── File Attachment (Drag Zone + File Cards) ────────────────────────────

interface FileAttachmentProps {
  /** List of already-attached files */
  files: FileOutput[];
  /** Called when a file is successfully uploaded */
  onFileUploaded?: (file: FileOutput) => void;
  /** Called when a file should be deleted */
  onFileDelete?: (fileId: string) => void;
}

/**
 * Drag-and-drop file attachment area with file cards.
 *
 * Shows a drop zone for uploading files, along with cards
 * for already-attached files. Non-image files are displayed here;
 * images are handled inline by the editor.
 */
export function FileAttachment({
  files,
  onFileUploaded,
  onFileDelete,
}: FileAttachmentProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, progress, uploading } = useFileUpload({
    onSuccess: (file) => {
      setUploadingFileName(null);
      onFileUploaded?.(file);
    },
    onError: () => {
      setUploadingFileName(null);
    },
  });

  const handleFiles = useCallback(
    async (fileList: FileList) => {
      for (const file of Array.from(fileList)) {
        setUploadingFileName(file.name);
        await upload(file);
      }
    },
    [upload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const nonImageFiles = files.filter(
    (f) => !f.mimeType.startsWith('image/'),
  );

  return (
    <div className="border-t border-border mt-8 pt-4">
      {/* Section header */}
      <p className="text-sm font-medium text-muted-foreground mb-3">
        첨부 파일 ({nonImageFiles.length})
      </p>

      {/* File cards */}
      {(nonImageFiles.length > 0 || uploading) && (
        <div className="flex flex-wrap gap-2 mb-4" role="list" aria-label="첨부 파일">
          {nonImageFiles.map((file) => (
            <div key={file.id} role="listitem" aria-label={`${file.name}, ${formatFileSize(file.size)}`}>
              <FileCard file={file} onDelete={onFileDelete} />
            </div>
          ))}
          {uploading && uploadingFileName && (
            <UploadingCard fileName={uploadingFileName} progress={progress} />
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        role="button"
        aria-label="파일 업로드"
        className={[
          'border-2 border-dashed rounded-lg p-8',
          'flex flex-col items-center justify-center gap-2',
          'transition-colors duration-150',
          isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border bg-background',
        ].join(' ')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload
          size={36}
          className={
            isDragOver ? 'text-primary' : 'text-muted-foreground'
          }
        />
        <p
          className={[
            'text-sm',
            isDragOver
              ? 'text-primary font-medium'
              : 'text-muted-foreground',
          ].join(' ')}
        >
          {isDragOver
            ? '파일을 놓아 업로드하세요'
            : '파일을 여기에 끌어다 놓거나'}
        </p>
        {!isDragOver && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            파일 선택
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
}
