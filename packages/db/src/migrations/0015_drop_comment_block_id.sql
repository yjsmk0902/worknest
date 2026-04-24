-- Migration: Drop comments.block_id and its index.
-- Block-level wiki-page comments were removed from the frontend and the
-- server routes; this leaves the column dormant. Dropping it keeps the
-- comments table minimal and prevents confusion about unused fields.
-- ─────────────────────────────────────────────────────────────────────────────

DROP INDEX IF EXISTS "comments_page_block_idx";

ALTER TABLE "comments"
  DROP COLUMN IF EXISTS "block_id";
