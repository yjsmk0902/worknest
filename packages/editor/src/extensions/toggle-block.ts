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
});

export const ToggleSummary = DetailsSummary;
export const ToggleContent = DetailsContent;
