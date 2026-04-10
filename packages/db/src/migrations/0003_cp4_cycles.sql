-- 0003_cp4_cycles.sql
-- CP-4 migration: Cycles and cycle-issues join table

-- ── Cycles ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cycles" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"  UUID        NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "name"        TEXT        NOT NULL,
  "description" TEXT,
  "start_date"  TIMESTAMPTZ,
  "end_date"    TIMESTAMPTZ,
  "status"      TEXT        NOT NULL DEFAULT 'draft',
  "created_by"  TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cycles_project_id_idx"
  ON "cycles" ("project_id");

-- Only one active cycle per project
CREATE UNIQUE INDEX IF NOT EXISTS "cycles_project_active_unique"
  ON "cycles" ("project_id")
  WHERE "status" = 'active';

-- ── Cycle Issues ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "cycle_issues" (
  "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "cycle_id"        UUID        NOT NULL REFERENCES "cycles" ("id") ON DELETE CASCADE,
  "issue_id"        UUID        NOT NULL REFERENCES "issues" ("id") ON DELETE CASCADE,
  "added_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "removed_at"      TIMESTAMPTZ,
  "carried_from_id" UUID        REFERENCES "cycle_issues" ("id") ON DELETE SET NULL
);

-- Prevent duplicate active entries per cycle
CREATE UNIQUE INDEX IF NOT EXISTS "cycle_issues_cycle_issue_active_unique"
  ON "cycle_issues" ("cycle_id", "issue_id")
  WHERE "removed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "cycle_issues_issue_id_idx"
  ON "cycle_issues" ("issue_id");
