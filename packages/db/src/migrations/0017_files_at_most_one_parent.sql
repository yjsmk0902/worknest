-- Migration: enforce "at most one parent" on files table.
-- A file attaches to an issue OR a wiki page (or neither, for transient
-- uploads). Prevents rows that accidentally point to both — which was
-- documented in the schema but never enforced.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "files"
  ADD CONSTRAINT "files_one_parent_check"
  CHECK (NOT ("issue_id" IS NOT NULL AND "page_id" IS NOT NULL));
