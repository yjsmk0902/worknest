import { type Editor, Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1'];

/**
 * Callback type for handling file uploads.
 * Should upload the file and return the public URL on success.
 */
export type ImageUploadHandler = (file: File) => Promise<string>;

/**
 * TipTap extension for image paste and drag-and-drop upload.
 *
 * When a user pastes or drops an image file into the editor:
 * 1. Validates file size and extension
 * 2. Inserts a placeholder node
 * 3. Calls the upload handler
 * 4. Replaces placeholder with the actual image on success
 *
 * The consuming application provides the upload handler function.
 */
export const ImageUpload = Extension.create({
  name: 'imageUpload',

  addOptions() {
    return {
      /** Async function that uploads a file and returns the URL. */
      uploadHandler: null as ImageUploadHandler | null,
    };
  },

  addProseMirrorPlugins() {
    const uploadHandler = this.options.uploadHandler;
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('imageUpload'),
        props: {
          handleDrop(_view, event) {
            if (!uploadHandler) return false;

            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
            if (imageFiles.length === 0) return false;

            event.preventDefault();

            for (const file of imageFiles) {
              handleImageFile(file, editor, uploadHandler);
            }

            return true;
          },

          handlePaste(_view, event) {
            if (!uploadHandler) return false;

            const files = event.clipboardData?.files;
            if (!files || files.length === 0) return false;

            const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
            if (imageFiles.length === 0) return false;

            event.preventDefault();

            for (const file of imageFiles) {
              handleImageFile(file, editor, uploadHandler);
            }

            return true;
          },
        },
      }),
    ];
  },
});

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return '파일 크기는 25MB를 초과할 수 없습니다';
  }

  const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return '이 파일 형식은 업로드할 수 없습니다';
  }

  return null;
}

async function handleImageFile(file: File, editor: Editor, uploadHandler: ImageUploadHandler) {
  const error = validateFile(file);
  if (error) {
    // Dispatch error event for the consuming application to handle
    const event = new CustomEvent('editor:upload-error', {
      detail: { message: error, fileName: file.name },
    });
    document.dispatchEvent(event);
    return;
  }

  // Insert placeholder
  const placeholderId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  editor
    .chain()
    .focus()
    .setImage({
      src: '',
      alt: file.name,
      title: placeholderId,
    })
    .run();

  try {
    const url = await uploadHandler(file);

    // Find and replace the placeholder image
    const { state } = editor;
    const { doc } = state;
    let found = false;

    doc.descendants((node: ProseMirrorNode, pos: number) => {
      if (found || node.type.name !== 'image' || node.attrs.title !== placeholderId) {
        return;
      }

      found = true;
      editor
        .chain()
        .focus()
        .setNodeSelection(pos)
        .setImage({ src: url, alt: file.name, title: '' })
        .run();
    });
  } catch {
    // Remove the placeholder on error
    const { state } = editor;
    const { doc } = state;

    doc.descendants((node: ProseMirrorNode, pos: number) => {
      if (node.type.name === 'image' && node.attrs.title === placeholderId) {
        editor.chain().focus().setNodeSelection(pos).deleteSelection().run();
        return false;
      }
    });

    const event = new CustomEvent('editor:upload-error', {
      detail: { message: '업로드에 실패했습니다', fileName: file.name },
    });
    document.dispatchEvent(event);
  }
}
