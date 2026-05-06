-- Migration: Issue templates — reusable issue presets per project.
-- Stores name, optional description, title prefill, TipTap JSON body,
-- priority, optional type, and a jsonb array of label UUIDs.
-- Labels are referenced loosely (filtered at apply-time).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "issue_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "title_template" text NOT NULL DEFAULT '',
  "body" jsonb,
  "priority" text NOT NULL DEFAULT 'none',
  "type_id" uuid REFERENCES "issue_types"("id") ON DELETE SET NULL,
  "label_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "issue_templates_priority_check"
    CHECK ("priority" IN ('urgent', 'high', 'medium', 'low', 'none'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "issue_templates_project_name_unique"
  ON "issue_templates" ("project_id", "name");
CREATE INDEX IF NOT EXISTS "issue_templates_project_id_idx"
  ON "issue_templates" ("project_id");
