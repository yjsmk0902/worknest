import type { Job } from "bullmq";

// ── Types ────────────────────────────────────────────────────────────────

interface ImageThumbnailJobData {
  fileId: string;
  filePath: string;
  mimeType: string;
}

// ── Processor ────────────────────────────────────────────────────────────

/**
 * Create an image thumbnail job processor.
 *
 * On image upload, generates a WebP thumbnail (400px width) saved alongside
 * the original file with a `.thumb.webp` suffix.
 *
 * Requires the `sharp` package.
 */
export function createImageThumbnailProcessor() {
  return async (job: Job<ImageThumbnailJobData>): Promise<void> => {
    const { filePath, mimeType } = job.data;

    // Only process images
    if (!mimeType.startsWith("image/")) return;

    try {
      // Dynamic import to handle cases where sharp is not installed
      const sharp = (await import("sharp")).default;

      const thumbnailPath = filePath.replace(/(\.[^.]+)$/, ".thumb.webp");

      await sharp(filePath)
        .resize(400, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    } catch (error) {
      // Log but don't fail the job — thumbnail is optional
      console.error(
        `Failed to generate thumbnail for ${filePath}:`,
        error,
      );
      throw error;
    }
  };
}
