import { eq, and, isNull, ilike, sql, inArray } from "drizzle-orm";
import {
  issues,
  projects,
  projectMembers,
  wikiPages,
  wikiSpaces,
  wikiSpaceMembers,
  type Database,
} from "@worknest/db";
import type { SearchQuery, SearchResultItem } from "@worknest/shared";

// ── Constants ──────────────────────────────────────────────────────────

/** Regex for issue-key patterns like "WRK-42" */
const ISSUE_KEY_PATTERN = /^([A-Z]{2,5})-(\d+)$/;

/** Default per-category limit */
const DEFAULT_LIMIT = 20;

// ── Service ────────────────────────────────────────────────────────────

export class SearchService {
  constructor(private db: Database) {}

  /**
   * Workspace-scoped search across issues, wiki pages, and projects.
   *
   * Strategy:
   * 1. If the query matches an issue key pattern (e.g. "WRK-42"), do a
   *    direct lookup by (prefix, sequence_id) in the given workspace.
   * 2. Full-text search using search_vector (issues) with ts_rank scoring.
   * 3. ILIKE fallback on titles for issues, wiki pages, and project names.
   * 4. Only return results from projects/spaces the caller has access to.
   * 5. Group results by category and cap per-category results.
   */
  async search(workspaceId: string, callerUserId: string, query: SearchQuery) {
    const q = query.q.trim();
    const limit = query.limit ?? DEFAULT_LIMIT;
    const requestedTypes = query.type
      ? query.type.split(",").map((t) => t.trim())
      : ["issue", "page", "project"];

    const issueResults: SearchResultItem[] = [];
    const pageResults: SearchResultItem[] = [];
    const projectResults: SearchResultItem[] = [];

    // ── 1. Issue-key direct lookup ─────────────────────────────────────

    const keyMatch = q.match(ISSUE_KEY_PATTERN);
    if (keyMatch && requestedTypes.includes("issue")) {
      const [, prefix, seqStr] = keyMatch;
      const sequenceId = Number.parseInt(seqStr, 10);

      const directRows = await this.db
        .select({
          id: issues.id,
          title: issues.title,
          sequenceId: issues.sequenceId,
          projectPrefix: projects.prefix,
        })
        .from(issues)
        .innerJoin(projects, eq(issues.projectId, projects.id))
        .innerJoin(
          projectMembers,
          and(
            eq(projectMembers.projectId, projects.id),
            eq(projectMembers.userId, callerUserId),
          ),
        )
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            eq(projects.prefix, prefix),
            eq(issues.sequenceId, sequenceId),
            isNull(issues.deletedAt),
            isNull(projects.deletedAt),
          ),
        )
        .limit(1);

      for (const row of directRows) {
        issueResults.push({
          id: row.id,
          type: "issue",
          title: row.title,
          subtitle: `${row.projectPrefix}-${row.sequenceId}`,
          url: `/issues/${row.id}`,
        });
      }
    }

    // If we got a direct match from issue key, skip the fuzzier searches
    // for issues but still search other categories.
    const skipIssueSearch = issueResults.length > 0;

    // ── 2 & 3. Full-text + ILIKE search (parallel) ────────────────────

    const searches: Promise<void>[] = [];

    if (requestedTypes.includes("issue") && !skipIssueSearch) {
      searches.push(
        this.searchIssues(q, workspaceId, callerUserId, limit).then((rows) => {
          issueResults.push(...rows);
        }),
      );
    }

    if (requestedTypes.includes("page")) {
      searches.push(
        this.searchPages(q, workspaceId, callerUserId, limit).then((rows) => {
          pageResults.push(...rows);
        }),
      );
    }

    if (requestedTypes.includes("project")) {
      searches.push(
        this.searchProjects(q, workspaceId, callerUserId, limit).then(
          (rows) => {
            projectResults.push(...rows);
          },
        ),
      );
    }

    await Promise.all(searches);

    // Combine all results for the flat list
    const allResults = [
      ...issueResults.slice(0, limit),
      ...pageResults.slice(0, limit),
      ...projectResults.slice(0, limit),
    ];

    return {
      results: allResults,
      categories: {
        issues: issueResults.slice(0, limit),
        pages: pageResults.slice(0, limit),
        projects: projectResults.slice(0, limit),
      },
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /**
   * Get project IDs the caller has access to in a workspace.
   */
  private async getAccessibleProjectIds(
    workspaceId: string,
    callerUserId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ id: projects.id })
      .from(projects)
      .innerJoin(
        projectMembers,
        and(
          eq(projectMembers.projectId, projects.id),
          eq(projectMembers.userId, callerUserId),
        ),
      )
      .where(
        and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)),
      );
    return rows.map((r) => r.id);
  }

  /**
   * Get wiki space IDs the caller has access to in a workspace.
   */
  private async getAccessibleSpaceIds(
    workspaceId: string,
    callerUserId: string,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ id: wikiSpaces.id })
      .from(wikiSpaces)
      .innerJoin(
        wikiSpaceMembers,
        and(
          eq(wikiSpaceMembers.wikiSpaceId, wikiSpaces.id),
          eq(wikiSpaceMembers.userId, callerUserId),
        ),
      )
      .where(eq(wikiSpaces.workspaceId, workspaceId));
    return rows.map((r) => r.id);
  }

  /**
   * Search issues using full-text search with ts_rank, falling back to
   * ILIKE on title.
   */
  private async searchIssues(
    q: string,
    workspaceId: string,
    callerUserId: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const projectIds = await this.getAccessibleProjectIds(workspaceId, callerUserId);
    if (projectIds.length === 0) return [];

    // Try full-text search first
    const ftsRows = await this.db
      .select({
        id: issues.id,
        title: issues.title,
        sequenceId: issues.sequenceId,
        projectPrefix: projects.prefix,
        rank: sql<number>`ts_rank(${issues}.search_vector, plainto_tsquery('english', ${q}))`.as(
          "rank",
        ),
      })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(
        and(
          sql`${issues}.search_vector @@ plainto_tsquery('english', ${q})`,
          inArray(issues.projectId, projectIds),
          isNull(issues.deletedAt),
        ),
      )
      .orderBy(
        sql`ts_rank(${issues}.search_vector, plainto_tsquery('english', ${q})) DESC`,
      )
      .limit(limit);

    if (ftsRows.length > 0) {
      return ftsRows.map((row) => ({
        id: row.id,
        type: "issue" as const,
        title: row.title,
        subtitle: `${row.projectPrefix}-${row.sequenceId}`,
        url: `/issues/${row.id}`,
      }));
    }

    // Fallback: ILIKE on title
    const ilikeRows = await this.db
      .select({
        id: issues.id,
        title: issues.title,
        sequenceId: issues.sequenceId,
        projectPrefix: projects.prefix,
      })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(
        and(
          ilike(issues.title, `%${q}%`),
          inArray(issues.projectId, projectIds),
          isNull(issues.deletedAt),
        ),
      )
      .limit(limit);

    return ilikeRows.map((row) => ({
      id: row.id,
      type: "issue" as const,
      title: row.title,
      subtitle: `${row.projectPrefix}-${row.sequenceId}`,
      url: `/issues/${row.id}`,
    }));
  }

  /**
   * Search wiki pages by ILIKE on title.
   */
  private async searchPages(
    q: string,
    workspaceId: string,
    callerUserId: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const spaceIds = await this.getAccessibleSpaceIds(workspaceId, callerUserId);
    if (spaceIds.length === 0) return [];

    const rows = await this.db
      .select({
        id: wikiPages.id,
        title: wikiPages.title,
        spaceName: wikiSpaces.name,
      })
      .from(wikiPages)
      .innerJoin(wikiSpaces, eq(wikiPages.wikiSpaceId, wikiSpaces.id))
      .where(
        and(
          ilike(wikiPages.title, `%${q}%`),
          inArray(wikiPages.wikiSpaceId, spaceIds),
          isNull(wikiPages.deletedAt),
        ),
      )
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      type: "page" as const,
      title: row.title,
      subtitle: row.spaceName,
      url: `/pages/${row.id}`,
    }));
  }

  /**
   * Search projects by ILIKE on name, filtered to workspace and membership.
   */
  private async searchProjects(
    q: string,
    workspaceId: string,
    callerUserId: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const rows = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        prefix: projects.prefix,
      })
      .from(projects)
      .innerJoin(
        projectMembers,
        and(
          eq(projectMembers.projectId, projects.id),
          eq(projectMembers.userId, callerUserId),
        ),
      )
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ilike(projects.name, `%${q}%`),
          isNull(projects.deletedAt),
        ),
      )
      .limit(limit);

    return rows.map((row) => ({
      id: row.id,
      type: "project" as const,
      title: row.name,
      subtitle: row.prefix,
      url: `/projects/${row.id}`,
    }));
  }
}
