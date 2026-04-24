import { Extension } from '@tiptap/core';
import Blockquote from '@tiptap/extension-blockquote';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
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
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef } from 'react';
import { TableToolbar } from './table-toolbar';
import { Toolbar } from './toolbar';

/**
 * Strips any stored `colwidth` from table cells/headers on every doc
 * change. Legacy content saved with resizable=true stored per-cell widths
 * that prosemirror-tables translates into a `<colgroup>` with inline
 * widths; that wrecks our fixed-layout table. Wiping the attribute at
 * load time (and on every edit) keeps the rendered colgroup empty so CSS
 * `table-layout: fixed` controls column distribution.
 */
const StripTableColwidth = Extension.create({
  name: 'stripTableColwidth',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('stripTableColwidth'),
        appendTransaction(_trs, _oldState, newState) {
          let tr = newState.tr;
          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (
              (node.type.name === 'tableCell' ||
                node.type.name === 'tableHeader') &&
              node.attrs.colwidth != null
            ) {
              tr = tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                colwidth: null,
              });
              modified = true;
            }
            return true;
          });
          return modified ? tr : null;
        },
      }),
    ];
  },
});

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
  /**
   * Called once when the TipTap editor instance is ready, and again with
   * `null` on unmount. Lets the consumer drive DOM-level decorations (e.g.
   * block comment markers) that need ProseMirror's `view.nodeDOM(pos)`.
   */
  onEditor?: (editor: ReturnType<typeof useEditor> | null) => void;
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
  onEditor,
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
        // Disable built-in blockquote so we can re-add it without the
        // `> ` input rule (we want `> ` to create a toggle instead, and
        // `| ` to become blockquote — see MarkdownShortcuts extension).
        blockquote: false,
      }),
      Blockquote.extend({
        addInputRules() {
          return [];
        },
      }),
      Typography,
      Placeholder.configure({
        // Placeholder only on the currently-focused empty node so the editor
        // doesn't get cluttered. Heading/quote show a short type-specific
        // hint so the user can confirm a slash/markdown transform worked.
        placeholder: ({ node, pos, editor: ed }) => {
          const name = node.type.name;
          if (name === 'heading') {
            const level = (node.attrs as { level?: number })?.level ?? 1;
            return `제목 ${level}`;
          }
          if (name === 'paragraph') {
            // Skip the "'/'로 블록 추가" hint inside table cells — the cell
            // already has its own chrome and the hint gets in the way of
            // normal typing.
            try {
              const $pos = ed.state.doc.resolve(pos);
              for (let d = $pos.depth; d >= 0; d -= 1) {
                const parentName = $pos.node(d).type.name;
                if (parentName === 'tableCell' || parentName === 'tableHeader') {
                  return '';
                }
              }
            } catch {
              // resolve() can fail transiently during transactions.
            }
            return pos === 0 ? placeholder : "'/'로 블록 추가";
          }
          // blockquote/bulletList/orderedList/taskItem/details/callout:
          // visual chrome (border/bullet/checkbox) is the cue — the inner
          // paragraph renders its own placeholder.
          return '';
        },
        showOnlyCurrent: true,
        includeChildren: true,
        emptyEditorClass:
          'before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:h-0 before:pointer-events-none',
        emptyNodeClass:
          'is-empty before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:h-0 before:pointer-events-none',
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
        // Column resizing causes rows to get out-of-sync colwidths when the
        // doc state is edited independently. Disabling plus stripping the
        // `colwidth` attribute below (so old stored widths don't leak into
        // the `<colgroup>`) keeps every row at the same column proportions
        // via CSS `table-layout: fixed`.
        resizable: false,
        HTMLAttributes: {
          class: 'worknest-table border-collapse w-full',
        },
      }),
      TableRow,
      TableCell.extend({
        // Drop the `colwidth` attr so prosemirror-tables never emits inline
        // <col style="width: …"> that would override our fixed layout.
        addAttributes() {
          const parent = this.parent?.() ?? {};
          return {
            ...parent,
            colwidth: {
              default: null,
              parseHTML: () => null,
              renderHTML: () => ({}),
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          class: 'border border-border p-2 align-top',
        },
      }),
      TableHeader.extend({
        addAttributes() {
          const parent = this.parent?.() ?? {};
          return {
            ...parent,
            colwidth: {
              default: null,
              parseHTML: () => null,
              renderHTML: () => ({}),
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          class: 'border border-border p-2 bg-muted font-semibold text-left align-top',
        },
      }),
      StripTableColwidth,
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

  // Expose the editor instance once ready. Keep the callback stable in a
  // ref so it doesn't retrigger setup just because the caller recreated it.
  const onEditorRef = useRef(onEditor);
  onEditorRef.current = onEditor;
  useEffect(() => {
    onEditorRef.current?.(editor ?? null);
    return () => onEditorRef.current?.(null);
  }, [editor]);

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
      {editor && editable && <Toolbar editor={editor} />}
      {editor && editable && <TableToolbar editor={editor} />}
    </div>
  );
}
