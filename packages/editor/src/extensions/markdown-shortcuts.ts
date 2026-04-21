import { Extension, InputRule, wrappingInputRule } from '@tiptap/core';

/**
 * Custom markdown-style input rules:
 *  - `| ` → blockquote (worknest convention; the default StarterKit
 *    blockquote rule `> ` is disabled elsewhere to free up `>`)
 *  - `> ` → details (toggle) block. Inserts an empty summary + a paragraph
 *    content, then the slash/keyboard normally lets the user type.
 *  - `--- ` → horizontal rule
 *  - ` ```` ` → code block
 */
export const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',

  addInputRules() {
    const rules: InputRule[] = [];
    const schema = this.editor.schema;

    if (schema.nodes.blockquote) {
      rules.push(
        wrappingInputRule({
          find: /^\s*\|\s$/,
          type: schema.nodes.blockquote,
        }),
      );
    }

    if (schema.nodes.details) {
      rules.push(
        new InputRule({
          find: /^\s*>\s$/,
          handler: ({ state, range, chain }) => {
            const { tr } = state;
            tr.delete(range.from, range.to);
            chain()
              .insertContentAt(range.from, {
                type: 'details',
                attrs: { open: true },
                content: [
                  { type: 'detailsSummary' },
                  { type: 'detailsContent', content: [{ type: 'paragraph' }] },
                ],
              })
              .run();

            requestAnimationFrame(() => {
              let summaryPos: number | null = null;
              this.editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'detailsSummary') {
                  summaryPos = pos + 1;
                }
                return true;
              });
              if (summaryPos !== null) {
                this.editor.chain().setTextSelection(summaryPos).focus().run();
              }
            });
          },
        }),
      );
    }

    // `--- ` at start of paragraph → horizontal rule
    if (schema.nodes.horizontalRule) {
      rules.push(
        new InputRule({
          find: /^---\s$/,
          handler: ({ chain, range }) => {
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
          handler: ({ chain, range, match }) => {
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
