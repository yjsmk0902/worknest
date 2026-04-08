/** Escape special ILIKE characters so they are matched literally. */
export function escapeLikePattern(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}
