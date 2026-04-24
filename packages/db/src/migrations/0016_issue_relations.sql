-- Migration: Issue relations (dependencies).
-- Directed edges expressing dependencies between two issues. 'blocks' is
-- asymmetric (source blocks target); 'relates_to' is an informational link.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_relations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "target_issue_id" uuid NOT NULL REFERENCES "issues"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "issue_relations_type_check" CHECK ("type" IN ('blocks', 'relates_to')),
  CONSTRAINT "issue_relations_no_self" CHECK ("source_issue_id" <> "target_issue_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_relations_unique"
  ON "issue_relations" ("source_issue_id", "target_issue_id", "type");
CREATE INDEX IF NOT EXISTS "issue_relations_source_idx"
  ON "issue_relations" ("source_issue_id");
CREATE INDEX IF NOT EXISTS "issue_relations_target_idx"
  ON "issue_relations" ("target_issue_id");
