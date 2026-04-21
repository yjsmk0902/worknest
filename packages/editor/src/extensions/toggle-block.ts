import Details from '@tiptap/extension-details';
import DetailsContent from '@tiptap/extension-details-content';
import DetailsSummary from '@tiptap/extension-details-summary';
import { TextSelection } from '@tiptap/pm/state';

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

        let detailsDepth = -1;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'details') {
            detailsDepth = d;
            break;
          }
        }
        if (detailsDepth < 0) return false;

        // Delete the empty paragraph inside the toggle and drop a fresh
        // paragraph right after the details node. Running both in the same
        // transaction keeps the positions consistent.
        const paraStart = $from.before();
        const paraEnd = $from.after();
        const paraLength = paraEnd - paraStart;
        const detailsEndPos = $from.end(detailsDepth) + 1;
        const insertPos = detailsEndPos - paraLength;

        const { tr } = state;
        tr.delete(paraStart, paraEnd);
        tr.insert(insertPos, schema.nodes.paragraph.create());
        tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)));
        editor.view.dispatch(tr.scrollIntoView());
        return true;
      },
    };
  },
}).configure({
  persist: true,
});

export const ToggleSummary = DetailsSummary;
export const ToggleContent = DetailsContent;
