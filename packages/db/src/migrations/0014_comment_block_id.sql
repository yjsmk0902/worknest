-- Migration: Add comments.block_id so wiki-page comments can anchor to a
-- specific block in the TipTap document. Issue comments leave it NULL.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "comments"
  ADD COLUMN IF NOT EXISTS "block_id" text;

CREATE INDEX IF NOT EXISTS "comments_page_block_idx"
  ON "comments" ("page_id", "block_id")
  WHERE "page_id" IS NOT NULL;
