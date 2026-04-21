import Details from '@tiptap/extension-details';
import DetailsContent from '@tiptap/extension-details-content';
import DetailsSummary from '@tiptap/extension-details-summary';

/**
 * Toggle (details/summary) block — a collapsible block.
 *
 * Uses TipTap's official Details extension suite. Rendered as `<details>`
 * so the browser handles open/close state natively.
 *
 * Extension-details defines its own Enter handler on `detailsSummary` that
 * moves the caret to `detailsContent`. On top of that we add an Enter
 * handler on empty paragraphs inside `detailsContent` that exits the whole
 * toggle so typing flows back to the outer document (Notion-style).
 */
export const ToggleBlock = Details.extend({
  addKeyboardShortcuts() {
    const parent = this.parent?.() ?? {};
    return {
      ...parent,
      Enter: ({ editor }) => {
        const parentEnter = parent.Enter;
        // Let the upstream Enter handler run first (summary → content).
        if (parentEnter?.({ editor })) return true;

        const { state } = editor;
        const { selection, schema } = state;
        const { $from, empty } = selection;
        if (!empty) return false;
        if ($from.parent.type !== schema.nodes.paragraph) return false;
        if ($from.parent.content.size !== 0) return false;

        // Walk up looking for detailsContent, then details
        let detailsDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'details') {
            detailsDepth = d;
            break;
          }
        }
        if (detailsDepth < 0) return false;

        const detailsEndPos = $from.end(detailsDepth) + 1;
        return editor
          .chain()
          .insertContentAt(detailsEndPos, { type: 'paragraph' })
          .setTextSelection(detailsEndPos + 1)
          .focus()
          .run();
      },
    };
  },
}).configure({
  persist: true,
});

export const ToggleSummary = DetailsSummary;
export const ToggleContent = DetailsContent;
