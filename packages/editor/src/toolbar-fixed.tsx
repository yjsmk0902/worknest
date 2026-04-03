import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Highlighter,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Minus,
  CodeSquare,
  Table,
  ImagePlus,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ToolbarFixedProps {
  /** TipTap editor instance */
  editor: Editor;
  /** Additional CSS class names */
  className?: string;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  icon,
  title,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-border mx-1 shrink-0" />;
}

type HeadingLevel = 1 | 2 | 3;

interface HeadingOption {
  label: string;
  level: HeadingLevel | null;
}

const HEADING_OPTIONS: HeadingOption[] = [
  { label: "Paragraph", level: null },
  { label: "Heading 1", level: 1 },
  { label: "Heading 2", level: 2 },
  { label: "Heading 3", level: 3 },
];

function TextStyleSelect({ editor }: { editor: Editor }) {
  const activeHeading = HEADING_OPTIONS.find((opt) =>
    opt.level
      ? editor.isActive("heading", { level: opt.level })
      : editor.isActive("paragraph"),
  );

  return (
    <select
      value={activeHeading?.label ?? "Paragraph"}
      onChange={(e) => {
        const option = HEADING_OPTIONS.find((opt) => opt.label === e.target.value);
        if (!option) return;

        if (option.level) {
          editor.chain().focus().toggleHeading({ level: option.level }).run();
        } else {
          editor.chain().focus().setParagraph().run();
        }
      }}
      className={[
        "h-8 px-2 text-sm rounded-md border border-border bg-transparent",
        "text-foreground cursor-pointer",
        "hover:bg-accent transition-colors",
        "focus:outline-none focus:ring-1 focus:ring-ring",
      ].join(" ")}
      title="Text style"
    >
      {HEADING_OPTIONS.map((opt) => (
        <option key={opt.label} value={opt.label}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Fixed toolbar rendered at the top of the editor area.
 *
 * Provides the full set of formatting options organized by category:
 * text style, inline formatting, lists, blocks, and insert actions.
 */
export function ToolbarFixed({ editor, className }: ToolbarFixedProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState("");

  const setLink = useCallback(() => {
    if (!linkInput) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setShowLinkInput(false);
      return;
    }

    const url = linkInput.match(/^https?:\/\//)
      ? linkInput
      : `https://${linkInput}`;

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setShowLinkInput(false);
    setLinkInput("");
  }, [editor, linkInput]);

  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setLink();
      }
      if (e.key === "Escape") {
        setShowLinkInput(false);
        setLinkInput("");
        editor.commands.focus();
      }
    },
    [setLink, editor],
  );

  const toggleLink = useCallback(() => {
    if (editor.isActive("link")) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkInput(previousUrl ?? "");
    setShowLinkInput(true);
  }, [editor]);

  const insertTable = useCallback(() => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  }, [editor]);

  const insertImage = useCallback(() => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  return (
    <div
      className={[
        "flex flex-wrap items-center gap-0.5 p-1",
        "border-b border-border bg-background",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Text style selector */}
      <TextStyleSelect editor={editor} />

      <Separator />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        icon={<Bold size={16} />}
        title="Bold (Cmd+B)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        icon={<Italic size={16} />}
        title="Italic (Cmd+I)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        icon={<Underline size={16} />}
        title="Underline (Cmd+U)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        icon={<Strikethrough size={16} />}
        title="Strikethrough (Cmd+Shift+S)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        icon={<Code size={16} />}
        title="Inline code (Cmd+E)"
      />

      <Separator />

      {/* Link and highlight */}
      <ToolbarButton
        onClick={toggleLink}
        isActive={editor.isActive("link")}
        icon={<Link size={16} />}
        title="Link (Cmd+K)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        icon={<Highlighter size={16} />}
        title="Highlight"
      />

      <Separator />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        icon={<List size={16} />}
        title="Bullet list (Cmd+Shift+8)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        icon={<ListOrdered size={16} />}
        title="Ordered list (Cmd+Shift+7)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        icon={<ListChecks size={16} />}
        title="Task list (Cmd+Shift+9)"
      />

      <Separator />

      {/* Block-level elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        icon={<Quote size={16} />}
        title="Blockquote"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        icon={<Minus size={16} />}
        title="Horizontal rule"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive("codeBlock")}
        icon={<CodeSquare size={16} />}
        title="Code block"
      />

      <Separator />

      {/* Insert actions */}
      <ToolbarButton
        onClick={insertTable}
        isActive={editor.isActive("table")}
        icon={<Table size={16} />}
        title="Insert table"
      />
      <ToolbarButton
        onClick={insertImage}
        icon={<ImagePlus size={16} />}
        title="Insert image"
      />

      {/* Link URL input (shown inline when link button is clicked) */}
      {showLinkInput && (
        <div className="flex items-center gap-1 ml-2 px-2 py-1 border border-border rounded-md bg-popover">
          <input
            type="url"
            placeholder="https://..."
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-muted-foreground"
            autoFocus
          />
          <button
            type="button"
            onClick={setLink}
            className="text-xs text-primary font-medium px-2 py-1 hover:bg-accent rounded"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(false);
              setLinkInput("");
            }}
            className="text-xs text-muted-foreground px-1 py-1 hover:bg-accent rounded"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
