-- Migration: Add icon + cover_url to wiki_pages
-- ─────────────────────────────────────────────────────────────────────────────
-- Supports Notion-style page aesthetics: emoji/icon picker and cover image.

ALTER TABLE "wiki_pages" ADD COLUMN "icon" text;
ALTER TABLE "wiki_pages" ADD COLUMN "cover_url" text;
