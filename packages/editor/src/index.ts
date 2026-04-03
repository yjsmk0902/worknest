// @worknest/editor — TipTap editor and extensions

// Core editor component
export { Editor } from "./editor";
export type { EditorProps } from "./editor";

// Editor with auto-save
export { EditorWithAutosave } from "./editor-with-autosave";
export type { EditorWithAutosaveProps } from "./editor-with-autosave";

// Floating toolbar (BubbleMenu)
export { Toolbar } from "./toolbar";

// Fixed toolbar
export { ToolbarFixed } from "./toolbar-fixed";

// Mention extension
export { createMentionExtension } from "./extensions/mention";
export type { MentionQueryFn, MentionUser } from "./extensions/mention";
export { MentionList } from "./extensions/mention-list";

// Re-export useful TipTap types for consumers
export type { JSONContent } from "@tiptap/core";
export type { Editor as TipTapEditor } from "@tiptap/react";
