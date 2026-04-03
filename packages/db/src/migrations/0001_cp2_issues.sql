-- 0001_cp2_issues.sql
-- CP-2 migration: Projects, Issues, Labels, Activities
-- Creates all project management tables, indexes, constraints, and full-text search.

-- ── Extensions ─────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Projects ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "projects" (
  "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id"  UUID        NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "name"          TEXT        NOT NULL,
  "description"   TEXT,
  "prefix"        TEXT        NOT NULL,
  "icon_url"      TEXT,
  "issue_counter" INTEGER     NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"    TIMESTAMPTZ
);

-- Partial unique index: (workspace_id, prefix) must be unique among non-deleted projects
CREATE UNIQUE INDEX IF NOT EXISTS "projects_ws_prefix_unique"
  ON "projects" ("workspace_id", "prefix")
  WHERE "deleted_at" IS NULL;

-- Partial unique index: (workspace_id, name) must be unique among non-deleted projects
CREATE UNIQUE INDEX IF NOT EXISTS "projects_ws_name_unique"
  ON "projects" ("workspace_id", "name")
  WHERE "deleted_at" IS NULL;

-- ── Project Members ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "project_members" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID        NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "user_id"    UUID        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role"       TEXT        NOT NULL,
  "joined_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_members_project_user_unique"
  ON "project_members" ("project_id", "user_id");

-- ── Issue Statuses ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_statuses" (
  "id"         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID    NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "name"       TEXT    NOT NULL,
  "color"      TEXT    NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_statuses_project_name_unique"
  ON "issue_statuses" ("project_id", "name");

-- ── Issue Types ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_types" (
  "id"         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID    NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "name"       TEXT    NOT NULL,
  "icon"       TEXT    NOT NULL,
  "color"      TEXT    NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_types_project_name_unique"
  ON "issue_types" ("project_id", "name");

-- ── Labels ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "labels" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"  UUID        NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "name"        TEXT        NOT NULL,
  "color"       TEXT        NOT NULL,
  "description" TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "labels_project_name_unique"
  ON "labels" ("project_id", "name");

-- ── Issues ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issues" (
  "id"               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id"       UUID        NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "sequence_id"      INTEGER     NOT NULL,
  "title"            TEXT        NOT NULL,
  "description"      JSONB,
  "description_text" TEXT,
  "status_id"        UUID        REFERENCES "issue_statuses" ("id") ON DELETE SET NULL,
  "type_id"          UUID        REFERENCES "issue_types" ("id") ON DELETE SET NULL,
  "priority"         TEXT        NOT NULL DEFAULT 'none',
  "parent_id"        UUID        REFERENCES "issues" ("id") ON DELETE SET NULL,
  "creator_id"       UUID        REFERENCES "users" ("id") ON DELETE SET NULL,
  "sort_order"       TEXT        NOT NULL DEFAULT 'a0',
  "due_date"         TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"       TIMESTAMPTZ,
  "search_vector"    TSVECTOR,
  CONSTRAINT "issues_priority_check" CHECK (
    "priority" IN ('urgent', 'high', 'medium', 'low', 'none')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS "issues_project_sequence_unique"
  ON "issues" ("project_id", "sequence_id");

CREATE INDEX IF NOT EXISTS "issues_project_id_idx"
  ON "issues" ("project_id");

CREATE INDEX IF NOT EXISTS "issues_status_id_idx"
  ON "issues" ("status_id");

CREATE INDEX IF NOT EXISTS "issues_parent_id_idx"
  ON "issues" ("parent_id");

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS "issues_search_vector_idx"
  ON "issues" USING GIN ("search_vector");

-- ── Issue Assignees ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_assignees" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "issue_id"    UUID        NOT NULL REFERENCES "issues" ("id") ON DELETE CASCADE,
  "user_id"     UUID        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_assignees_issue_user_unique"
  ON "issue_assignees" ("issue_id", "user_id");

-- ── Issue Labels ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_labels" (
  "id"       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "issue_id" UUID NOT NULL REFERENCES "issues" ("id") ON DELETE CASCADE,
  "label_id" UUID NOT NULL REFERENCES "labels" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_labels_issue_label_unique"
  ON "issue_labels" ("issue_id", "label_id");

-- ── Activities ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "activities" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id"   UUID        REFERENCES "users" ("id") ON DELETE SET NULL,
  "issue_id"   UUID        REFERENCES "issues" ("id") ON DELETE CASCADE,
  "project_id" UUID        REFERENCES "projects" ("id") ON DELETE CASCADE,
  "action"     TEXT        NOT NULL,
  "field"      TEXT,
  "old_value"  TEXT,
  "new_value"  TEXT,
  "metadata"   JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "activities_issue_id_idx"
  ON "activities" ("issue_id");

CREATE INDEX IF NOT EXISTS "activities_project_id_idx"
  ON "activities" ("project_id");

-- ── Full-Text Search Trigger ──────────────────────────────────────────

-- Trigger function to auto-update search_vector from title + description_text
CREATE OR REPLACE FUNCTION issues_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "title", "description_text"
  ON "issues"
  FOR EACH ROW
  EXECUTE FUNCTION issues_search_vector_update();
