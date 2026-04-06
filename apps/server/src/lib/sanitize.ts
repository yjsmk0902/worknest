/**
 * TipTap JSON content sanitizer.
 *
 * Strips dangerous nodes (script, iframe, etc.) from TipTap JSON to prevent
 * XSS when rendering wiki content.
 */

// Node types that are never allowed
const DANGEROUS_NODE_TYPES = new Set([
  "script",
  "iframe",
  "embed",
  "object",
  "applet",
  "form",
]);

// Attribute names that may contain dangerous values
const DANGEROUS_ATTRS = new Set([
  "onerror",
  "onload",
  "onclick",
  "onmouseover",
  "onfocus",
  "onblur",
  "oninput",
  "onsubmit",
  "onkeydown",
  "onkeyup",
  "onkeypress",
]);

interface TipTapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  marks?: TipTapMark[];
  text?: string;
  [key: string]: unknown;
}

interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/**
 * Strip dangerous attributes from a node's attrs object.
 */
function sanitizeAttrs(
  attrs: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!attrs) return attrs;

  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attrs)) {
    // Skip event handlers
    if (DANGEROUS_ATTRS.has(key.toLowerCase())) continue;

    // Skip dangerous URI schemes (javascript:, data:, vbscript:)
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        normalized.startsWith("javascript:") ||
        normalized.startsWith("data:") ||
        normalized.startsWith("vbscript:")
      ) {
        continue;
      }
    }

    cleaned[key] = value;
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Recursively sanitize a TipTap JSON node, removing dangerous content.
 */
function sanitizeNode(node: TipTapNode): TipTapNode | null {
  // Remove dangerous node types entirely
  if (node.type && DANGEROUS_NODE_TYPES.has(node.type.toLowerCase())) {
    return null;
  }

  const sanitized: TipTapNode = { ...node };

  // Sanitize attributes
  if (sanitized.attrs) {
    sanitized.attrs = sanitizeAttrs(sanitized.attrs);
  }

  // Sanitize marks
  if (sanitized.marks) {
    sanitized.marks = sanitized.marks
      .filter((mark) => !DANGEROUS_NODE_TYPES.has(mark.type.toLowerCase()))
      .map((mark) => ({
        ...mark,
        attrs: sanitizeAttrs(mark.attrs),
      }));
  }

  // Recursively sanitize children
  if (Array.isArray(sanitized.content)) {
    sanitized.content = sanitized.content
      .map(sanitizeNode)
      .filter((child): child is TipTapNode => child !== null);
  }

  return sanitized;
}

/**
 * Sanitize TipTap JSON content, stripping any script/dangerous nodes.
 *
 * @param content Raw TipTap JSON content (unknown type for safety)
 * @returns Sanitized TipTap JSON content
 */
export function sanitizeContent(content: unknown): unknown {
  if (content === null || content === undefined) return null;

  // If it's not an object, return as-is (likely invalid content)
  if (typeof content !== "object") return content;

  return sanitizeNode(content as TipTapNode);
}
