-- 0004_cp5_wiki.sql
-- CP-5 migration: Wiki spaces, pages, files, and issue mentions

-- ── Wiki Spaces ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "wiki_spaces" (
  "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id"  UUID        NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "name"          TEXT        NOT NULL,
  "description"   TEXT,
  "slug"          TEXT        NOT NULL,
  "created_by"    TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_spaces_workspace_slug_unique"
  ON "wiki_spaces" ("workspace_id", "slug");

CREATE INDEX IF NOT EXISTS "wiki_spaces_workspace_id_idx"
  ON "wiki_spaces" ("workspace_id");

-- ── Wiki Space Members ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "wiki_space_members" (
  "id"            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "wiki_space_id" UUID        NOT NULL REFERENCES "wiki_spaces" ("id") ON DELETE CASCADE,
  "user_id"       TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role"          TEXT        NOT NULL DEFAULT 'editor',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_space_members_space_user_unique"
  ON "wiki_space_members" ("wiki_space_id", "user_id");

-- ── Wiki Pages ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "wiki_pages" (
  "id"              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "wiki_space_id"   UUID        NOT NULL REFERENCES "wiki_spaces" ("id") ON DELETE CASCADE,
  "title"           TEXT        NOT NULL,
  "slug"            TEXT        NOT NULL,
  "content"         JSONB,
  "content_format"  TEXT        NOT NULL DEFAULT 'json',
  "content_text"    TEXT,
  "parent_id"       UUID        REFERENCES "wiki_pages" ("id") ON DELETE SET NULL,
  "sort_order"      TEXT        NOT NULL DEFAULT 'a0',
  "created_by"      TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "wiki_pages_space_id_idx"
  ON "wiki_pages" ("wiki_space_id");

CREATE INDEX IF NOT EXISTS "wiki_pages_parent_id_idx"
  ON "wiki_pages" ("parent_id");

-- Unique slug per space among non-deleted pages
CREATE UNIQUE INDEX IF NOT EXISTS "wiki_pages_space_slug_unique"
  ON "wiki_pages" ("wiki_space_id", "slug")
  WHERE "deleted_at" IS NULL;

-- ── Files ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "files" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "issue_id"    UUID        REFERENCES "issues" ("id") ON DELETE CASCADE,
  "page_id"     UUID        REFERENCES "wiki_pages" ("id") ON DELETE CASCADE,
  "name"        TEXT        NOT NULL,
  "path"        TEXT        NOT NULL,
  "mime_type"   TEXT        NOT NULL,
  "size"        INTEGER     NOT NULL,
  "uploaded_by" TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "files_issue_id_idx"
  ON "files" ("issue_id");

CREATE INDEX IF NOT EXISTS "files_page_id_idx"
  ON "files" ("page_id");

-- Polymorphic constraint: a file belongs to at most one parent
ALTER TABLE "files" DROP CONSTRAINT IF EXISTS "files_parent_check";
ALTER TABLE "files" ADD CONSTRAINT "files_parent_check"
  CHECK (NOT ("issue_id" IS NOT NULL AND "page_id" IS NOT NULL));

-- ── Issue Mentions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_mentions" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "issue_id"   UUID        NOT NULL REFERENCES "issues" ("id") ON DELETE CASCADE,
  "page_id"    UUID        NOT NULL REFERENCES "wiki_pages" ("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_mentions_issue_page_unique"
  ON "issue_mentions" ("issue_id", "page_id");
