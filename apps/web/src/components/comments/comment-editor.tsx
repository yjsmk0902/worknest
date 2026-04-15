import { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import LinkExtension from '@tiptap/extension-link';
import { Bold, Italic, Link, AtSign } from 'lucide-react';
import { Button, cn } from '@worknest/ui';
import { createMentionExtension, type MentionQueryFn } from '@worknest/editor';

// ── Types ──────────────────────────────────────────────────────────────

interface CommentEditorProps {
  /** Callback when comment is submitted */
  onSubmit: (content: JSONContent) => void;
  /** Pre-fill editor with content (for editing) */
  initialContent?: JSONContent | null;
  /** Placeholder text */
  placeholder?: string;
  /** Show cancel button and fire this callback */
  onCancel?: () => void;
  /** Submit button label (default: none, submit via Cmd+Enter) */
  submitLabel?: string;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
  /** Function to query mention suggestions */
  mentionQueryFn?: MentionQueryFn;
  /** Auto-focus on mount */
  autofocus?: boolean;
}

// ── Toolbar Button ─────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  isActive = false,
  icon,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center justify-center w-7 h-7 rounded-sm transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {icon}
    </button>
  );
}

// ── CommentEditor ──────────────────────────────────────────────────────

export function CommentEditor({
  onSubmit,
  initialContent = null,
  placeholder = '댓글을 작성하세요...',
  onCancel,
  submitLabel,
  isSubmitting = false,
  mentionQueryFn,
  autofocus = false,
}: CommentEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // Ref-based submit to avoid stale closure in handleKeyDown
  const submitRef = useRef<() => void>(() => {});

  const extensions = [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      horizontalRule: false,
      blockquote: false,
    }),
    Placeholder.configure({
      placeholder,
      emptyEditorClass:
        'before:content-[attr(data-placeholder)] before:text-muted-foreground before:float-left before:h-0 before:pointer-events-none',
    }),
    LinkExtension.configure({
      autolink: true,
      openOnClick: true,
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2 cursor-pointer hover:text-primary/80',
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    ...(mentionQueryFn ? [createMentionExtension(mentionQueryFn)] : []),
  ];

  const editor = useEditor({
    extensions,
    content: initialContent ?? undefined,
    autofocus: autofocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[80px] px-3 py-2 text-sm leading-relaxed',
        role: 'textbox',
        'aria-label': '댓글 작성',
        'aria-multiline': 'true',
      },
      handleKeyDown: (view, event) => {
        // Don't intercept Enter when a suggestion popup (mention/slash) is open
        const hasSuggestion = !!document.querySelector('[data-suggestion-popup]');
        if (event.key === 'Enter' && hasSuggestion) {
          return false; // let the suggestion plugin handle it
        }
        // Enter to submit (Shift+Enter for newline)
        if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          submitRef.current();
          return true;
        }
        // Escape to cancel
        if (event.key === 'Escape' && onCancelRef.current) {
          event.preventDefault();
          onCancelRef.current();
          return true;
        }
        return false;
      },
    },
  });

  const isEmpty = !editor || editor.isEmpty;

  const handleSubmit = useCallback(() => {
    if (!editor || editor.isEmpty) return;
    const json = editor.getJSON();
    onSubmitRef.current(json);
    editor.commands.clearContent(true);
  }, [editor]);

  // Keep the ref in sync
  submitRef.current = handleSubmit;

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    if (!linkInput) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowLinkInput(false);
      return;
    }

    const url = linkInput.match(/^https?:\/\//) ? linkInput : `https://${linkInput}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setShowLinkInput(false);
    setLinkInput('');
  }, [editor, linkInput]);

  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSetLink();
      }
      if (e.key === 'Escape') {
        setShowLinkInput(false);
        setLinkInput('');
        editor?.commands.focus();
      }
    },
    [handleSetLink, editor],
  );

  const toggleLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    setLinkInput(previousUrl ?? '');
    setShowLinkInput(true);
  }, [editor]);

  const insertMention = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent('@').run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      {/* Editor area */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <EditorContent editor={editor} />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          icon={<Bold size={14} />}
          title="Bold (Cmd+B)"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          icon={<Italic size={14} />}
          title="Italic (Cmd+I)"
        />
        <ToolbarButton
          onClick={toggleLink}
          isActive={editor.isActive('link')}
          icon={<Link size={14} />}
          title="Link (Cmd+K)"
        />
        {mentionQueryFn && (
          <ToolbarButton
            onClick={insertMention}
            icon={<AtSign size={14} />}
            title="Mention"
          />
        )}

        {/* Link URL inline input */}
        {showLinkInput && (
          <div className="ml-1 flex items-center gap-1 rounded-md border border-border bg-popover px-2 py-0.5">
            <input
              type="url"
              placeholder="https://..."
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onKeyDown={handleLinkKeyDown}
              className="w-40 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSetLink}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLinkInput(false);
                setLinkInput('');
              }}
              className="rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Right side: actions */}
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 text-xs">
              취소
            </Button>
          )}
          {submitLabel && (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isEmpty || isSubmitting}
              className="h-7 text-xs"
            >
              {submitLabel}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">Enter로 전송 · Shift+Enter 줄바꿈</span>
        </div>
      </div>
    </div>
  );
}
