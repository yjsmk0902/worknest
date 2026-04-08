/**
 * TipTap JSON plain text extractor.
 *
 * Recursively walks TipTap JSON nodes and extracts all text content
 * into a single plain string, useful for full-text search indexing.
 */

interface TipTapNode {
  type?: string;
  text?: string;
  content?: TipTapNode[];
  [key: string]: unknown;
}

// Block-level node types that should be followed by a newline for readability.
// Hoisted to module scope to avoid re-creating the Set on every call.
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'listItem',
  'horizontalRule',
  'table',
  'tableRow',
]);

/**
 * Recursively extract text from a TipTap JSON node tree.
 */
function walkNode(node: unknown, parts: string[]): void {
  if (!node || typeof node !== 'object') return;

  const n = node as TipTapNode;

  // Extract text from text nodes
  if (n.text && typeof n.text === 'string') {
    parts.push(n.text);
  }

  // Recurse into children
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      walkNode(child, parts);
    }
  }

  // Add separator after block nodes
  if (n.type && BLOCK_TYPES.has(n.type)) {
    parts.push('\n');
  }
}

/**
 * Extract plain text from TipTap JSON content.
 *
 * @param content TipTap JSON content (unknown type for safety)
 * @returns Plain text string with block-level nodes separated by newlines
 */
export function extractPlainText(content: unknown): string {
  if (content === null || content === undefined) return '';

  if (typeof content !== 'object') return '';

  const parts: string[] = [];
  walkNode(content, parts);

  // Join and clean up excessive whitespace/newlines
  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
