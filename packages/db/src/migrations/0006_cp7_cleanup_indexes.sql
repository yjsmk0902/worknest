-- CP-7: Partial indexes on deleted_at columns for soft-delete queries.
-- These speed up the hard-delete cleanup job and any query filtering by
-- deleted_at IS NOT NULL (e.g. trash / restore views).

CREATE INDEX IF NOT EXISTS issues_deleted_at_idx ON issues (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS wiki_pages_deleted_at_idx ON wiki_pages (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_deleted_at_idx ON comments (deleted_at) WHERE deleted_at IS NOT NULL;
