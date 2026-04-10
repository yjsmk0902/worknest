import { useCallback, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { Avatar, Button } from '@worknest/ui';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@worknest/ui';
import { toast } from '@worknest/ui';

interface ImageUploadProps {
  currentUrl: string | null;
  fallback: string;
  onUpdate: (url: string | null) => void;
  shape?: 'avatar' | 'logo';
}

function extractFileId(url: string): string | null {
  const match = url.match(/\/api\/v1\/files\/([^/]+)\//);
  return match?.[1] ?? null;
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/files/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) throw new Error('Upload failed');
  const json = await response.json();
  return `/api/v1/files/${json.data.id}/serve`;
}

async function deleteOldFile(url: string): Promise<void> {
  const fileId = extractFileId(url);
  if (!fileId) return;
  try {
    await fetch(`/api/v1/files/${fileId}`, { method: 'DELETE', credentials: 'include' });
  } catch { /* best-effort */ }
}

function cropImage(
  img: HTMLImageElement,
  crop: { x: number; y: number; zoom: number },
  cropViewSize: number,
  outputSize: number,
  circular: boolean,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    if (circular) {
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
    }

    // Match the cropper view exactly:
    // In the cropper, image base width = cropViewSize, scaled by zoom.
    // Canvas is outputSize x outputSize, so scale positions by ratio.
    const ratio = outputSize / cropViewSize;
    const drawW = outputSize * crop.zoom;
    const drawH = (img.naturalHeight / img.naturalWidth) * outputSize * crop.zoom;
    const drawX = outputSize / 2 - drawW / 2 + crop.x * crop.zoom * ratio;
    const drawY = outputSize / 2 - drawH / 2 + crop.y * crop.zoom * ratio;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to create blob'));
        resolve(new File([blob], 'cropped.png', { type: 'image/png' }));
      },
      'image/png',
      1,
    );
  });
}

// ── Cropper Component ────────────────────────────────────────────────

const CROP_SIZE = 240;
const OUTPUT_SIZE = 512;

function ImageCropper({
  src,
  circular,
  crop,
  onCropChange,
}: {
  src: string;
  circular: boolean;
  crop: { x: number; y: number; zoom: number };
  onCropChange: (c: { x: number; y: number; zoom: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      onCropChange({
        ...crop,
        x: crop.x + dx / crop.zoom,
        y: crop.y + dy / crop.zoom,
      });
    },
    [crop, onCropChange],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.min(5, Math.max(0.5, crop.zoom + delta));
      onCropChange({ ...crop, zoom: newZoom });
    },
    [crop, onCropChange],
  );

  return (
    <div
      ref={containerRef}
      className="relative mx-auto select-none overflow-hidden bg-muted"
      style={{
        width: CROP_SIZE,
        height: CROP_SIZE,
        borderRadius: circular ? '50%' : 12,
        cursor: 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <img
        src={src}
        alt="crop"
        draggable={false}
        className="pointer-events-none absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${crop.x * crop.zoom}px, ${crop.y * crop.zoom}px) scale(${crop.zoom})`,
          maxWidth: 'none',
          maxHeight: 'none',
          width: CROP_SIZE,
          height: 'auto',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────

export function ImageUpload({
  currentUrl,
  fallback,
  onUpdate,
  shape = 'logo',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const circular = shape === 'avatar';

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const newUrl = await uploadFile(file);
      if (currentUrl) await deleteOldFile(currentUrl);
      return newUrl;
    },
    onSuccess: (url) => {
      closePreview();
      onUpdate(url);
      toast('이미지가 변경되었습니다.');
    },
    onError: () => {
      closePreview();
      toast('이미지 업로드에 실패했습니다.');
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('5MB 이하의 이미지만 업로드할 수 있습니다.');
      return;
    }

    setCrop({ x: 0, y: 0, zoom: 1 });
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCrop({ x: 0, y: 0, zoom: 1 });
    imgRef.current = null;
  }

  async function handleConfirm() {
    if (!previewUrl) return;

    // Load image for cropping
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = previewUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    const croppedFile = await cropImage(img, crop, CROP_SIZE, OUTPUT_SIZE, circular);
    uploadMutation.mutate(croppedFile);
  }

  function handleRemove() {
    if (currentUrl) deleteOldFile(currentUrl);
    onUpdate(null);
  }

  const isUploading = uploadMutation.isPending;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center gap-4">
        <div className="relative">
          {shape === 'avatar' ? (
            <Avatar src={currentUrl} fallback={fallback} size="lg" />
          ) : currentUrl ? (
            <img src={currentUrl} alt={fallback} className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
              {fallback.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            변경
          </Button>
          {currentUrl && (
            <Button variant="ghost" size="sm" onClick={handleRemove}>
              제거
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => { if (!open && !isUploading) closePreview(); }}
      >
        <DialogContent className="max-w-[360px]">
          <DialogHeader>
            <DialogTitle>이미지 조정</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-2">
            {previewUrl && (
              <ImageCropper
                src={previewUrl}
                circular={circular}
                crop={crop}
                onCropChange={setCrop}
              />
            )}

            <p className="text-xs text-muted-foreground">
              드래그하여 위치 조정 · 스크롤로 확대/축소
            </p>

            {/* Zoom slider */}
            <div className="flex w-full items-center gap-3 px-2">
              <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.05"
                value={crop.zoom}
                onChange={(e) => setCrop((prev) => ({ ...prev, zoom: Number(e.target.value) }))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
              />
              <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePreview} disabled={isUploading}>
              취소
            </Button>
            <Button onClick={handleConfirm} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  업로드 중...
                </>
              ) : (
                '적용'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
