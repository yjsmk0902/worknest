-- 0000_initial.sql
-- Initial schema migration for Worknest CP-1
-- Creates all application tables, indexes, and constraints.

-- ── Extensions ─────────────────────────────────────────────────────────

-- gen_random_uuid() is built into PG 13+, but pgcrypto provides it for older versions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "users" (
  "id"             TEXT        PRIMARY KEY,
  "email"          TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "avatar_url"     TEXT,
  "email_verified" BOOLEAN     NOT NULL DEFAULT false,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "users_email_unique" UNIQUE ("email")
);

-- ── Better Auth: Sessions ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sessions" (
  "id"         TEXT        PRIMARY KEY,
  "user_id"    TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "token"      TEXT        NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "sessions_token_unique" UNIQUE ("token")
);

-- ── Better Auth: Accounts ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "accounts" (
  "id"                    TEXT        PRIMARY KEY,
  "user_id"               TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "account_id"            TEXT        NOT NULL,
  "provider_id"           TEXT        NOT NULL,
  "access_token"          TEXT,
  "refresh_token"         TEXT,
  "access_token_expires_at" TIMESTAMPTZ,
  "refresh_token_expires_at" TIMESTAMPTZ,
  "scope"                 TEXT,
  "id_token"              TEXT,
  "password"              TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Better Auth: Verifications ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "verifications" (
  "id"         TEXT        PRIMARY KEY,
  "identifier" TEXT        NOT NULL,
  "value"      TEXT        NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Organizations ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "organizations" (
  "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       TEXT        NOT NULL,
  "slug"       TEXT        NOT NULL,
  "logo"       TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at" TIMESTAMPTZ
);

-- Partial unique index: slug must be unique among non-deleted orgs
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_unique"
  ON "organizations" ("slug")
  WHERE "deleted_at" IS NULL;

-- ── Org Members ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "org_members" (
  "id"        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"    UUID        NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "user_id"   TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role"      TEXT        NOT NULL,
  "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "org_members_org_user_unique"
  ON "org_members" ("org_id", "user_id");

-- ── Workspaces ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"      UUID        NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "name"        TEXT        NOT NULL,
  "slug"        TEXT        NOT NULL,
  "logo"        TEXT,
  "description" TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deleted_at"  TIMESTAMPTZ
);

-- Partial unique index: (org_id, slug) must be unique among non-deleted workspaces
CREATE UNIQUE INDEX IF NOT EXISTS "workspaces_org_slug_unique"
  ON "workspaces" ("org_id", "slug")
  WHERE "deleted_at" IS NULL;

-- ── Workspace Members ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id"           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" UUID        NOT NULL REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "user_id"      TEXT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "role"         TEXT        NOT NULL,
  "invited_by"   TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "joined_at"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_ws_user_unique"
  ON "workspace_members" ("workspace_id", "user_id");

-- ── Invitations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invitations" (
  "id"           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       UUID        REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "workspace_id" UUID        REFERENCES "workspaces" ("id") ON DELETE CASCADE,
  "email"        TEXT        NOT NULL,
  "role"         TEXT        NOT NULL,
  "token_hash"   TEXT        NOT NULL,
  "invited_by"   TEXT        REFERENCES "users" ("id") ON DELETE SET NULL,
  "expires_at"   TIMESTAMPTZ NOT NULL,
  "accepted_at"  TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "invitations_token_hash_unique" UNIQUE ("token_hash"),
  -- Exactly one of org_id or workspace_id must be set
  CONSTRAINT "invitations_target_check" CHECK (
    ("org_id" IS NOT NULL AND "workspace_id" IS NULL)
    OR ("org_id" IS NULL AND "workspace_id" IS NOT NULL)
  )
);

-- Partial unique: one pending invitation per workspace + email
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_ws_email_unique"
  ON "invitations" ("workspace_id", "email")
  WHERE "accepted_at" IS NULL;

-- Partial unique: one pending invitation per org + email
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_org_email_unique"
  ON "invitations" ("org_id", "email")
  WHERE "accepted_at" IS NULL;
