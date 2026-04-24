-- Migration: Wiki page revisions table for edit history / rollback.
-- Snapshots are written by the server when a page update crosses the
-- dedupe window since the last snapshot by the same author.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "wiki_page_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "page_id" uuid NOT NULL REFERENCES "wiki_pages"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "icon" text,
  "content" jsonb,
  "content_text" text,
  "author_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "wiki_page_revisions_page_id_idx"
  ON "wiki_page_revisions" ("page_id");

CREATE INDEX IF NOT EXISTS "wiki_page_revisions_page_created_idx"
  ON "wiki_page_revisions" ("page_id", "created_at");
