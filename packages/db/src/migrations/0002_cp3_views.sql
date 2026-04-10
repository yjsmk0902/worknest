-- 0002_cp3_views.sql
-- CP-3 migration: Views table, issue_statuses/issue_types extensions, filter indexes

-- ── Views ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "views" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID        NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "name"       TEXT        NOT NULL,
  "created_by" TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "filters"    JSONB,
  "sort"       JSONB,
  "group_by"   TEXT,
  "type"       TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "views_project_id_idx"
  ON "views" ("project_id");

CREATE INDEX IF NOT EXISTS "views_project_created_by_idx"
  ON "views" ("project_id", "created_by");

-- ── Issue Statuses: add category & is_default ────────────────────────────

ALTER TABLE "issue_statuses"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'backlog';

ALTER TABLE "issue_statuses"
  ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Backfill category for existing seed data (idempotent)
UPDATE "issue_statuses" SET "category" = 'backlog'   WHERE "name" = 'Backlog'     AND "category" = 'backlog';
UPDATE "issue_statuses" SET "category" = 'unstarted'  WHERE "name" = 'Todo';
UPDATE "issue_statuses" SET "category" = 'started'    WHERE "name" = 'In Progress';
UPDATE "issue_statuses" SET "category" = 'completed'  WHERE "name" = 'Done';
UPDATE "issue_statuses" SET "category" = 'cancelled'  WHERE "name" = 'Cancelled';

-- Set default status (idempotent)
UPDATE "issue_statuses" SET "is_default" = true WHERE "name" = 'Backlog';

-- ── Issue Types: add is_default ──────────────────────────────────────────

ALTER TABLE "issue_types"
  ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN NOT NULL DEFAULT false;

-- Set default type (idempotent)
UPDATE "issue_types" SET "is_default" = true WHERE "name" = 'Task';

-- ── Filter Performance Indexes ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "issues_priority_idx"
  ON "issues" ("priority");

CREATE INDEX IF NOT EXISTS "issues_due_date_idx"
  ON "issues" ("due_date");

CREATE INDEX IF NOT EXISTS "issues_creator_id_idx"
  ON "issues" ("creator_id");

CREATE INDEX IF NOT EXISTS "issue_assignees_user_id_idx"
  ON "issue_assignees" ("user_id");
