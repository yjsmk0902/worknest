import Details from '@tiptap/extension-details';
import DetailsContent from '@tiptap/extension-details-content';
import DetailsSummary from '@tiptap/extension-details-summary';

/**
 * Toggle (details/summary) block — a collapsible block.
 *
 * Uses TipTap's official Details extension suite. Rendered as `<details>`
 * so the browser handles open/close state natively.
 *
 * Usage in document JSON:
 *   { type: 'details', attrs: { open: true },
 *     content: [
 *       { type: 'detailsSummary', content: [{ type: 'text', text: 'Summary' }] },
 *       { type: 'detailsContent', content: [{ type: 'paragraph' }] },
 *     ] }
 */
export const ToggleBlock = Details.configure({
  persist: true,
  HTMLAttributes: {
    class:
      'my-3 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] px-3 py-2 [&>summary]:cursor-pointer [&>summary]:list-none [&>summary]:select-none [&>summary]:font-medium [&>summary::-webkit-details-marker]:hidden',
  },
});

export const ToggleSummary = DetailsSummary;
export const ToggleContent = DetailsContent.configure({
  HTMLAttributes: {
    class: 'mt-2 pl-4',
  },
});
