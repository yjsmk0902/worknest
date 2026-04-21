-- Migration: Link wiki_spaces to projects (optional) so each project can
-- own its default wiki space, accessible from both the project menu and
-- the top-level Wiki section.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "wiki_spaces"
  ADD COLUMN "project_id" uuid REFERENCES "projects"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "wiki_spaces_project_id_idx"
  ON "wiki_spaces" ("project_id");

-- At most one wiki space per project (for the auto-created one)
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_spaces_project_unique"
  ON "wiki_spaces" ("project_id")
  WHERE "project_id" IS NOT NULL;
