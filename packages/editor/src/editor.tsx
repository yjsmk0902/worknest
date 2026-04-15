import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import Underline from '@tiptap/extension-underline';
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef } from 'react';

const lowlight = createLowlight(common);

export interface EditorProps {
  /** TipTap JSON content to render */
  content: JSONContent | null;
  /** Callback fired on every content change with JSON and plain text */
  onUpdate?: (json: JSONContent, text: string) => void;
  /** Whether the editor is editable (default: true) */
  editable?: boolean;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Additional CSS class names for the editor wrapper */
  className?: string;
  /** Whether to autofocus the editor on mount */
  autofocus?: boolean;
  /** Additional TipTap extensions to include */
  extensions?: Parameters<typeof useEditor>[0] extends { extensions?: infer E } ? E : never;
}

/**
 * Core TipTap editor component.
 *
 * Provides a rich text editor with support for headings, lists, tables,
 * code blocks with syntax highlighting, task lists, links, images, and more.
 */
export function Editor({
  content,
  onUpdate,
  editable = true,
  placeholder = 'Write something...',
  className,
  autofocus = false,
  extensions: extraExtensions,
}: EditorProps) {
  // Use ref to avoid stale closure in onUpdate callback
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default codeBlock in favor of CodeBlockLowlight
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:h-0 before:pointer-events-none',
      }),
      Link.configure({
        autolink: true,
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: 'rounded-md max-w-full',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse table-auto w-full',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-2 relative min-w-[80px]',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border p-2 bg-muted font-semibold text-left min-w-[80px]',
        },
      }),
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-800',
        },
      }),
      Underline,
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'bg-muted rounded-md p-4 font-mono text-sm overflow-x-auto not-prose',
        },
      }),
      ...(extraExtensions ?? []),
    ],
    content: content ?? undefined,
    editable,
    autofocus: autofocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      const text = ed.getText();
      onUpdateRef.current?.(json, text);
    },
  });

  // Sync editable prop changes
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync external content changes (e.g., from server)
  const handleContentSync = useCallback(
    (newContent: JSONContent | null) => {
      if (!editor || editor.isDestroyed) return;

      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(newContent);

      // Only update if content actually differs to avoid cursor jumping
      if (currentJson !== newJson) {
        editor.commands.setContent(newContent ?? { type: 'doc', content: [] });
      }
    },
    [editor],
  );

  // Track previous content to detect external changes
  const prevContentRef = useRef(content);
  useEffect(() => {
    if (content !== prevContentRef.current) {
      prevContentRef.current = content;
      handleContentSync(content);
    }
  }, [content, handleContentSync]);

  return (
    <div
      className={[
        'prose prose-sm dark:prose-invert max-w-none',
        'text-base leading-relaxed',
        // Task list styling
        "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0",
        "[&_ul[data-type='taskList']_li]:flex [&_ul[data-type='taskList']_li]:items-start [&_ul[data-type='taskList']_li]:gap-2",
        "[&_ul[data-type='taskList']_input]:mt-1",
        // Table styling
        '[&_table]:border-collapse [&_table]:w-full',
        // Image styling
        '[&_img]:rounded-md [&_img]:max-w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
