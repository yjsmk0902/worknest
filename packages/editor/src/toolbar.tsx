import { BubbleMenu, type Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Highlighter,
} from "lucide-react";
import { useCallback, useState } from "react";

interface ToolbarProps {
  /** TipTap editor instance */
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  icon: React.ReactNode;
  title: string;
}

function ToolbarButton({ onClick, isActive, icon, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

/**
 * Floating toolbar that appears on text selection (BubbleMenu).
 *
 * Provides quick access to inline formatting: bold, italic, underline,
 * strikethrough, code, link, and highlight.
 */
export function Toolbar({ editor }: ToolbarProps) {
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);

  const setLink = useCallback(() => {
    if (!linkInput) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setShowLinkInput(false);
      return;
    }

    // Add protocol if missing
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

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 150,
        placement: "top",
      }}
      className="bg-popover border border-border rounded-lg shadow-md flex items-center gap-0.5 p-1"
    >
      {showLinkInput ? (
        <div className="flex items-center gap-1 px-1">
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
      ) : (
        <>
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

          {/* Separator */}
          <div className="w-px h-5 bg-border mx-0.5" />

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
        </>
      )}
    </BubbleMenu>
  );
}
