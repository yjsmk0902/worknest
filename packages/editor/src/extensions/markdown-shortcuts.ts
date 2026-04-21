import { Extension, InputRule, wrappingInputRule } from '@tiptap/core';

/**
 * Custom markdown-style input rules:
 *  - `| ` → blockquote (worknest convention; the default StarterKit
 *    blockquote rule `> ` is disabled elsewhere to free up `>`)
 *  - `> ` → details (toggle) block. Inserts an empty summary + a paragraph
 *    content, then the slash/keyboard normally lets the user type.
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

            // Move caret into the new detailsSummary on the next frame so
            // the transaction from insertContentAt has already committed.
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

    return rules;
  },
});
