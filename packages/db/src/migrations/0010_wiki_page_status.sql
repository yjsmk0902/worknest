-- Migration: Add `status` (draft/published) to wiki_pages
-- ─────────────────────────────────────────────────────────────────────────────
-- Drafts are only visible to their author; everyone else sees published only.

ALTER TABLE "wiki_pages"
  ADD COLUMN "status" text NOT NULL DEFAULT 'published';

-- Helpful filter index
CREATE INDEX IF NOT EXISTS "wiki_pages_space_status_idx"
  ON "wiki_pages" ("wiki_space_id", "status")
  WHERE "deleted_at" IS NULL;
