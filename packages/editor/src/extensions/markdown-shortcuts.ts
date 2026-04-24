import { Extension, InputRule } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';

/** True if the position is anywhere inside a table cell. */
function isInsideTableCell(state: EditorState, pos: number): boolean {
  try {
    const $pos = state.doc.resolve(pos);
    for (let d = $pos.depth; d >= 0; d -= 1) {
      const name = $pos.node(d).type.name;
      if (name === 'tableCell' || name === 'tableHeader') return true;
    }
  } catch {
    // resolve() can fail mid-transaction; treat as "not in cell" to be safe.
  }
  return false;
}

/**
 * Custom markdown-style input rules:
 *  - `| ` → blockquote (worknest convention)
 *  - `--- ` → horizontal rule
 *  - ` ```` ` → code block
 */
export const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',

  addInputRules() {
    const rules: InputRule[] = [];
    const schema = this.editor.schema;

    if (schema.nodes.blockquote) {
      // Custom rule instead of wrappingInputRule so we can skip inside table
      // cells (turning a cell's paragraph into a blockquote breaks the cell
      // layout). `chain().wrapIn` is the wrappingInputRule equivalent.
      rules.push(
        new InputRule({
          find: /^\s*\|\s$/,
          handler: ({ state, range, chain }) => {
            if (isInsideTableCell(state, range.from)) return;
            chain().deleteRange(range).wrapIn('blockquote').run();
          },
        }),
      );
    }

    // `--- ` at start of paragraph → horizontal rule
    if (schema.nodes.horizontalRule) {
      rules.push(
        new InputRule({
          find: /^---\s$/,
          handler: ({ state, chain, range }) => {
            if (isInsideTableCell(state, range.from)) return;
            chain()
              .deleteRange(range)
              .setNode('paragraph')
              .insertContent({ type: 'horizontalRule' })
              .run();
          },
        }),
      );
    }

    // ``` ` at start of paragraph → code block (lowlight-aware)
    if (schema.nodes.codeBlock) {
      rules.push(
        new InputRule({
          find: /^```([a-z]*)\s$/,
          handler: ({ state, chain, range, match }) => {
            if (isInsideTableCell(state, range.from)) return;
            const language = match[1]?.trim() || null;
            chain()
              .deleteRange(range)
              .setNode('codeBlock', language ? { language } : {})
              .run();
          },
        }),
      );
    }

    return rules;
  },

  /**
   * Notion-style Backspace: at the start of a heading or blockquote with
   * an empty first paragraph, unwrap to a plain paragraph.
   */
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state } = editor;
        const { selection, schema } = state;
        const { $from, empty } = selection;
        if (!empty || $from.parentOffset !== 0) return false;

        const parent = $from.parent;
        if (parent.type === schema.nodes.heading) {
          return editor.chain().setNode('paragraph').run();
        }

        // Blockquote: if cursor in first inner paragraph at offset 0, unwrap
        if ($from.depth >= 2) {
          const grand = $from.node($from.depth - 1);
          if (
            grand.type === schema.nodes.blockquote &&
            parent.type === schema.nodes.paragraph &&
            parent.content.size === 0
          ) {
            return editor.chain().lift('blockquote').run();
          }
        }
        return false;
      },
      // Enter on empty blockquote paragraph → exit blockquote
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection, schema } = state;
        const { $from, empty } = selection;
        if (!empty) return false;
        if ($from.parent.type !== schema.nodes.paragraph) return false;
        if ($from.parent.content.size !== 0) return false;

        if ($from.depth < 2) return false;
        const grand = $from.node($from.depth - 1);
        if (grand.type !== schema.nodes.blockquote) return false;

        const blockquoteEndPos = $from.end($from.depth - 1) + 1;
        return editor
          .chain()
          .insertContentAt(blockquoteEndPos, { type: 'paragraph' })
          .setTextSelection(blockquoteEndPos + 1)
          .focus()
          .run();
      },
    };
  },
});
