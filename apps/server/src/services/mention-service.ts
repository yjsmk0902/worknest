import { type Database, issueMentions } from '@worknest/db';
import { eq, inArray } from 'drizzle-orm';

// ── Types ──────────────────────────────────────────────────────────────

interface TipTapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Recursively extract issue IDs from TipTap JSON content.
 * Looks for nodes of type 'issue-link' with an 'issueId' attribute.
 */
function extractIssueIds(content: unknown): Set<string> {
  const ids = new Set<string>();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;

    const n = node as TipTapNode;

    // Check if this node is an issue-link with an issueId attribute
    if (n.type === 'issue-link' && n.attrs?.issueId) {
      const issueId = String(n.attrs.issueId);
      if (issueId) {
        ids.add(issueId);
      }
    }

    // Recurse into children
    if (Array.isArray(n.content)) {
      for (const child of n.content) {
        walk(child);
      }
    }
  }

  walk(content);
  return ids;
}

// ── Service ────────────────────────────────────────────────────────────

export class MentionService {
  constructor(private db: Database) {}

  /**
   * Extract issue references from TipTap JSON content and sync the
   * issueMentions table for the given page.
   *
   * This performs a full reconciliation:
   * - Inserts new mentions
   * - Removes mentions that are no longer in the content
   */
  async syncMentions(pageId: string, content: unknown): Promise<void> {
    const issueIds = extractIssueIds(content);

    // Get existing mentions for this page
    const existingMentions = await this.db
      .select({
        id: issueMentions.id,
        issueId: issueMentions.issueId,
      })
      .from(issueMentions)
      .where(eq(issueMentions.pageId, pageId));

    const existingIssueIds = new Set(existingMentions.map((m) => m.issueId));

    // Determine additions and removals
    const toAdd = [...issueIds].filter((id) => !existingIssueIds.has(id));
    const toRemove = existingMentions.filter((m) => !issueIds.has(m.issueId));

    // Perform inserts and deletes in a transaction for consistency
    if (toAdd.length > 0 || toRemove.length > 0) {
      await this.db.transaction(async (tx) => {
        if (toAdd.length > 0) {
          await tx.insert(issueMentions).values(
            toAdd.map((issueId) => ({
              issueId,
              pageId,
            })),
          );
        }

        if (toRemove.length > 0) {
          const removeIds = toRemove.map((m) => m.id);
          await tx.delete(issueMentions).where(inArray(issueMentions.id, removeIds));
        }
      });
    }
  }
}
