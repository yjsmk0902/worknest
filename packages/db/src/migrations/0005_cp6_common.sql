-- 0005_cp6_common.sql
-- CP-6 migration: Comments, Reactions, Notifications, Favorites, Search Infrastructure

-- ── Comments ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "comments" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "issue_id"    UUID        REFERENCES "issues" ("id") ON DELETE CASCADE,
  "page_id"     UUID        REFERENCES "wiki_pages" ("id") ON DELETE CASCADE,
  "content"     JSONB       NOT NULL,
  "parent_id"   UUID        REFERENCES "comments" ("id") ON DELETE CASCADE,
  "author_id"   TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "resolved_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "comments_issue_id_idx"
  ON "comments" ("issue_id");

CREATE INDEX IF NOT EXISTS "comments_page_id_idx"
  ON "comments" ("page_id");

CREATE INDEX IF NOT EXISTS "comments_parent_id_idx"
  ON "comments" ("parent_id");

CREATE INDEX IF NOT EXISTS "comments_author_id_idx"
  ON "comments" ("author_id");

-- Polymorphic constraint: exactly one of (issue_id, page_id) must be set
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS "comments_parent_check";
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_check"
  CHECK (
    ("issue_id" IS NOT NULL AND "page_id" IS NULL) OR
    ("issue_id" IS NULL AND "page_id" IS NOT NULL)
  );

-- ── Reactions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "reactions" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "comment_id" UUID        NOT NULL REFERENCES "comments" ("id") ON DELETE CASCADE,
  "user_id"    TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "emoji"      TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "reactions_comment_user_emoji_unique"
  ON "reactions" ("comment_id", "user_id", "emoji");

-- ── Notifications ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "issue_id"   UUID        REFERENCES "issues" ("id") ON DELETE CASCADE,
  "page_id"    UUID        REFERENCES "wiki_pages" ("id") ON DELETE CASCADE,
  "type"       TEXT        NOT NULL,
  "message"    TEXT        NOT NULL,
  "read_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_user_read_idx"
  ON "notifications" ("user_id", "read_at");

CREATE INDEX IF NOT EXISTS "notifications_user_created_idx"
  ON "notifications" ("user_id", "created_at");

-- At most one of (issue_id, page_id) — both can be NULL (e.g. invited type)
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_parent_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_parent_check"
  CHECK (NOT ("issue_id" IS NOT NULL AND "page_id" IS NOT NULL));

-- ── Favorites ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "favorites" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "project_id" UUID        REFERENCES "projects" ("id") ON DELETE CASCADE,
  "issue_id"   UUID        REFERENCES "issues" ("id") ON DELETE CASCADE,
  "page_id"    UUID        REFERENCES "wiki_pages" ("id") ON DELETE CASCADE,
  "space_id"   UUID        REFERENCES "wiki_spaces" ("id") ON DELETE CASCADE,
  "sort_order" TEXT        NOT NULL DEFAULT 'a0',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "favorites_user_sort_idx"
  ON "favorites" ("user_id", "sort_order");

-- Exactly one of (project_id, issue_id, page_id, space_id) must be set
ALTER TABLE "favorites" DROP CONSTRAINT IF EXISTS "favorites_target_check";
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_target_check"
  CHECK (
    (
      ("project_id" IS NOT NULL)::int +
      ("issue_id"   IS NOT NULL)::int +
      ("page_id"    IS NOT NULL)::int +
      ("space_id"   IS NOT NULL)::int
    ) = 1
  );

-- Partial unique indexes: one favorite per user per target entity
CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_project_unique"
  ON "favorites" ("user_id", "project_id")
  WHERE "project_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_issue_unique"
  ON "favorites" ("user_id", "issue_id")
  WHERE "issue_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_page_unique"
  ON "favorites" ("user_id", "page_id")
  WHERE "page_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "favorites_user_space_unique"
  ON "favorites" ("user_id", "space_id")
  WHERE "space_id" IS NOT NULL;

-- ── Search Infrastructure ──────────────────────────────────────────────

-- Wiki pages search vector
ALTER TABLE "wiki_pages" ADD COLUMN IF NOT EXISTS "search_vector" TSVECTOR;

CREATE INDEX IF NOT EXISTS "wiki_pages_search_vector_idx"
  ON "wiki_pages" USING GIN ("search_vector");

-- Wiki pages search vector trigger (same pattern as issues)
CREATE OR REPLACE FUNCTION wiki_pages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wiki_pages_search_vector_trigger ON wiki_pages;
CREATE TRIGGER wiki_pages_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, content_text ON wiki_pages
  FOR EACH ROW EXECUTE FUNCTION wiki_pages_search_vector_update();

-- pg_trgm GIN indexes for ILIKE
CREATE INDEX IF NOT EXISTS "issues_title_trgm_idx"
  ON "issues" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "wiki_pages_title_trgm_idx"
  ON "wiki_pages" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "projects_name_trgm_idx"
  ON "projects" USING GIN ("name" gin_trgm_ops);
