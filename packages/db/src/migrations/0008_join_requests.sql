-- Migration: Add org tags + join requests
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add new columns to organizations (tag nullable first for backfill)
ALTER TABLE "organizations" ADD COLUMN "tag" text;
ALTER TABLE "organizations" ADD COLUMN "description" text;
ALTER TABLE "organizations" ADD COLUMN "show_member_count" boolean NOT NULL DEFAULT true;

-- 2. Backfill existing orgs with random tags (XXXX-0000 format)
DO $$
DECLARE
  r RECORD;
  new_tag TEXT;
  tag_exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM organizations WHERE tag IS NULL LOOP
    LOOP
      new_tag := chr(65 + floor(random() * 26)::int)
              || chr(65 + floor(random() * 26)::int)
              || chr(65 + floor(random() * 26)::int)
              || chr(65 + floor(random() * 26)::int)
              || '-'
              || lpad(floor(random() * 10000)::text, 4, '0');

      SELECT EXISTS(
        SELECT 1 FROM organizations WHERE tag = new_tag AND deleted_at IS NULL
      ) INTO tag_exists;

      EXIT WHEN NOT tag_exists;
    END LOOP;

    UPDATE organizations SET tag = new_tag WHERE id = r.id;
  END LOOP;
END $$;

-- 3. Make tag NOT NULL now that all rows have a value
ALTER TABLE "organizations" ALTER COLUMN "tag" SET NOT NULL;

-- 4. Unique partial index on tag (only non-deleted orgs)
CREATE UNIQUE INDEX "organizations_tag_unique" ON "organizations" ("tag") WHERE "deleted_at" IS NULL;

-- 5. Create join_requests table
CREATE TABLE "join_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" text,
  "status" text NOT NULL,
  "reviewed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 6. Indexes for join_requests
CREATE INDEX "join_requests_org_status_idx" ON "join_requests" ("org_id", "status");
CREATE UNIQUE INDEX "join_requests_org_user_pending_unique" ON "join_requests" ("org_id", "user_id") WHERE "status" = 'pending';
