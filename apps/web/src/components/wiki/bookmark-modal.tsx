import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@worknest/ui';
import { useEffect, useRef, useState } from 'react';

export interface BookmarkModalEventDetail {
  onSubmit: (url: string) => void;
}

declare global {
  interface WindowEventMap {
    'editor:bookmark-prompt': CustomEvent<BookmarkModalEventDetail>;
  }
}

/**
 * Modal that prompts the user for a URL to bookmark. Driven by a
 * `window.dispatchEvent(new CustomEvent('editor:bookmark-prompt', { detail: { onSubmit } }))`
 * so the TipTap slash command doesn't have to couple to React state.
 */
export function BookmarkModal() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pendingOnSubmit = useRef<((url: string) => void) | null>(null);

  useEffect(() => {
    const handler = (e: CustomEvent<BookmarkModalEventDetail>) => {
      pendingOnSubmit.current = e.detail.onSubmit;
      setUrl('');
      setError(null);
      setOpen(true);
    };
    window.addEventListener('editor:bookmark-prompt', handler);
    return () => window.removeEventListener('editor:bookmark-prompt', handler);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setError('URL을 입력하세요');
      return;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('http 또는 https URL만 지원됩니다');
        return;
      }
      pendingOnSubmit.current?.(parsed.toString());
      pendingOnSubmit.current = null;
      setOpen(false);
    } catch {
      setError('올바른 URL이 아닙니다');
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) pendingOnSubmit.current = null;
        setOpen(next);
      }}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>북마크 추가</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bookmark-url">URL</Label>
            <Input
              id="bookmark-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              autoFocus
            />
            {error && <p className="text-xs text-[color:var(--priority-urgent)]">{error}</p>}
            <p className="text-xs text-[color:var(--fg-3)]">
              카드 형태로 제목, 설명, 썸네일이 함께 표시됩니다.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button type="submit" disabled={!url.trim()}>
              북마크 추가
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
