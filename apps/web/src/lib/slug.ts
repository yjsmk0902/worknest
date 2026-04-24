/**
 * Generate a slug from a human-readable title.
 *
 * ASCII-only with dash separators. Non-ASCII characters (e.g. Korean) get
 * stripped, so callers should combine the result with a random suffix when
 * uniqueness matters (see {@link pageSlug}).
 */
export function slugifyTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * A short URL-safe random suffix (base36, 6 chars, ~30 bits of entropy —
 * plenty for per-space uniqueness).
 */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/**
 * Build a wiki-page slug. If the title yields a non-empty ASCII slug we
 * keep it and append a random suffix for uniqueness inside the space; if
 * the title is only non-ASCII (e.g. Korean "새 페이지") we fall back to
 * `page-{random}` so the slug stays readable-ish and never empty.
 */
export function pageSlug(title: string): string {
  const base = slugifyTitle(title);
  const suffix = randomSuffix();
  if (base.length === 0) return `page-${suffix}`;
  return `${base}-${suffix}`;
}
