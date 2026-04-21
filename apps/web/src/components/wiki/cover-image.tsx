import { useFileUpload } from '@/hooks/use-file-upload';
import { Button, toast } from '@worknest/ui';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef } from 'react';

interface CoverImageProps {
  url: string | null;
  onChange: (url: string | null) => void;
}

/**
 * Notion-style page cover: full-width banner image above the title.
 *
 * Clicking "커버 추가" opens a file picker; clicking the image reveals
 * change/remove actions on hover.
 */
export function CoverImage({ url, onChange }: CoverImageProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, uploading } = useFileUpload({
    onError: (msg) => toast(msg),
  });

  const handleSelect = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    const result = await upload(file);
    if (result) onChange(result.path);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {url ? (
        <div className="group relative h-[200px] w-full overflow-hidden bg-[color:var(--bg-2)]">
          <img src={url} alt="" className="h-full w-full object-cover" />
          <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSelect}
              disabled={uploading}
              className="h-7 bg-[color:var(--bg-0)]/80 text-[12px] backdrop-blur"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              <span>변경</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onChange(null)}
              className="h-7 bg-[color:var(--bg-0)]/80 text-[12px] backdrop-blur"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>제거</span>
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Small inline button for adding a cover when the page has none.
 * Placed alongside the icon button above the title.
 */
export function AddCoverButton({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-[12.5px] text-[color:var(--fg-3)] transition-colors hover:bg-[color:var(--bg-2)] hover:text-[color:var(--fg-1)] disabled:opacity-50"
    >
      <ImagePlus className="h-3.5 w-3.5" />
      <span>커버 추가</span>
    </button>
  );
}
