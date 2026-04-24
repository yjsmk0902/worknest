-- Migration: Add wiki_page_shares for tokenized read-only public links.
-- A page can have multiple shares (different expirations / audiences).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "wiki_page_shares" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "page_id" uuid NOT NULL REFERENCES "wiki_pages"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "expires_at" timestamptz,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "wiki_page_shares_token_unique"
  ON "wiki_page_shares" ("token");

CREATE INDEX IF NOT EXISTS "wiki_page_shares_page_id_idx"
  ON "wiki_page_shares" ("page_id");
