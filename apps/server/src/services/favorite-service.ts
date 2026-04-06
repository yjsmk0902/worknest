import { eq, and, asc, desc, isNull } from "drizzle-orm";
import {
  favorites,
  projects,
  projectMembers,
  issues,
  wikiPages,
  wikiSpaces,
  wikiSpaceMembers,
  type Database,
} from "@worknest/db";
import type {
  CreateFavoriteInput,
  UpdateFavoriteInput,
  FavoriteEntityType,
} from "@worknest/shared";
import { generateKeyBetween } from "@worknest/shared";
import { AppError, ErrorCode } from "../lib/errors";

// ── Types ──────────────────────────────────────────────────────────────

/** Maps entity type to the corresponding FK column in the favorites table. */
const ENTITY_TYPE_TO_COLUMN = {
  project: "projectId",
  issue: "issueId",
  page: "pageId",
  space: "spaceId",
} as const;

// ── Service ────────────────────────────────────────────────────────────

export class FavoriteService {
  constructor(private db: Database) {}

  /**
   * List all favorites for a user, ordered by sort_order ascending.
   * Joins entity tables to resolve entity names.
   */
  async list(callerUserId: string) {
    const rows = await this.db
      .select({
        favorite: favorites,
        projectName: projects.name,
        issueName: issues.title,
        pageName: wikiPages.title,
        spaceName: wikiSpaces.name,
      })
      .from(favorites)
      .leftJoin(projects, eq(favorites.projectId, projects.id))
      .leftJoin(issues, eq(favorites.issueId, issues.id))
      .leftJoin(wikiPages, eq(favorites.pageId, wikiPages.id))
      .leftJoin(wikiSpaces, eq(favorites.spaceId, wikiSpaces.id))
      .where(eq(favorites.userId, callerUserId))
      .orderBy(asc(favorites.sortOrder));

    return rows.map((row) => this.formatFavoriteWithName(row));
  }

  /**
   * Create a new favorite.
   *
   * Maps the `entityType` to the correct FK column and sets the others to null.
   * Generates a sort_order that places the new favorite at the end of the list.
   */
  async create(callerUserId: string, input: CreateFavoriteInput) {
    const { entityType, entityId } = input;

    // Verify entity exists and caller has access
    await this.verifyEntityAccess(callerUserId, entityType, entityId);

    // Check for duplicate
    const fkColumn = ENTITY_TYPE_TO_COLUMN[entityType];
    const existing = await this.db
      .select({ id: favorites.id })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, callerUserId),
          eq(favorites[fkColumn], entityId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (existing) {
      throw AppError.conflict(
        ErrorCode.ALREADY_A_MEMBER,
        "This item is already in your favorites",
      );
    }

    // Find the last favorite to generate a sort_order after it
    const lastFavorite = await this.db
      .select({ sortOrder: favorites.sortOrder })
      .from(favorites)
      .where(eq(favorites.userId, callerUserId))
      .orderBy(desc(favorites.sortOrder))
      .limit(1)
      .then((rows) => rows[0]);

    const sortOrder = generateKeyBetween(
      lastFavorite?.sortOrder ?? null,
      null,
    );

    // Build the insert values with only the matching FK set
    const insertValues: Record<string, unknown> = {
      userId: callerUserId,
      sortOrder,
      projectId: null,
      issueId: null,
      pageId: null,
      spaceId: null,
    };
    insertValues[fkColumn] = entityId;

    const [created] = await this.db
      .insert(favorites)
      .values(insertValues as typeof favorites.$inferInsert)
      .returning();

    return this.formatFavorite(created);
  }

  /**
   * Update a favorite's sort_order (for drag-and-drop reorder).
   *
   * Verifies ownership before updating.
   */
  async update(
    favoriteId: string,
    callerUserId: string,
    input: UpdateFavoriteInput,
  ) {
    const existing = await this.getOwnedFavorite(favoriteId, callerUserId);

    const [updated] = await this.db
      .update(favorites)
      .set({ sortOrder: input.sortOrder })
      .where(eq(favorites.id, existing.id))
      .returning();

    return this.formatFavorite(updated);
  }

  /**
   * Delete a favorite.
   *
   * Verifies ownership before deleting.
   */
  async delete(favoriteId: string, callerUserId: string) {
    const existing = await this.getOwnedFavorite(favoriteId, callerUserId);

    await this.db.delete(favorites).where(eq(favorites.id, existing.id));
  }

  // ── Private helpers ─────────────────────────────────────────────────

  /**
   * Get a favorite and verify it belongs to the caller.
   */
  private async getOwnedFavorite(favoriteId: string, callerUserId: string) {
    const row = await this.db
      .select()
      .from(favorites)
      .where(
        and(eq(favorites.id, favoriteId), eq(favorites.userId, callerUserId)),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!row) {
      throw AppError.notFound("favorite");
    }

    return row;
  }

  /**
   * Verify that the entity exists and the caller has membership to access it.
   */
  private async verifyEntityAccess(
    callerUserId: string,
    entityType: FavoriteEntityType,
    entityId: string,
  ) {
    switch (entityType) {
      case "project": {
        const project = await this.db
          .select({ id: projects.id })
          .from(projects)
          .where(and(eq(projects.id, entityId), isNull(projects.deletedAt)))
          .limit(1)
          .then((rows) => rows[0]);
        if (!project) throw AppError.notFound("project");

        const member = await this.db
          .select({ id: projectMembers.id })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, entityId),
              eq(projectMembers.userId, callerUserId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!member) throw AppError.forbidden("You are not a member of this project");
        break;
      }

      case "issue": {
        const issue = await this.db
          .select({ id: issues.id, projectId: issues.projectId })
          .from(issues)
          .where(and(eq(issues.id, entityId), isNull(issues.deletedAt)))
          .limit(1)
          .then((rows) => rows[0]);
        if (!issue) throw AppError.notFound("issue");

        const member = await this.db
          .select({ id: projectMembers.id })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, issue.projectId),
              eq(projectMembers.userId, callerUserId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!member) throw AppError.forbidden("You are not a member of this project");
        break;
      }

      case "page": {
        const page = await this.db
          .select({ id: wikiPages.id, wikiSpaceId: wikiPages.wikiSpaceId })
          .from(wikiPages)
          .where(and(eq(wikiPages.id, entityId), isNull(wikiPages.deletedAt)))
          .limit(1)
          .then((rows) => rows[0]);
        if (!page) throw AppError.notFound("wiki_page");

        const member = await this.db
          .select({ id: wikiSpaceMembers.id })
          .from(wikiSpaceMembers)
          .where(
            and(
              eq(wikiSpaceMembers.wikiSpaceId, page.wikiSpaceId),
              eq(wikiSpaceMembers.userId, callerUserId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!member) throw AppError.forbidden("You are not a member of this wiki space");
        break;
      }

      case "space": {
        const space = await this.db
          .select({ id: wikiSpaces.id })
          .from(wikiSpaces)
          .where(eq(wikiSpaces.id, entityId))
          .limit(1)
          .then((rows) => rows[0]);
        if (!space) throw AppError.notFound("wiki_space");

        const member = await this.db
          .select({ id: wikiSpaceMembers.id })
          .from(wikiSpaceMembers)
          .where(
            and(
              eq(wikiSpaceMembers.wikiSpaceId, entityId),
              eq(wikiSpaceMembers.userId, callerUserId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (!member) throw AppError.forbidden("You are not a member of this wiki space");
        break;
      }
    }
  }

  /**
   * Derive the entityType from the non-null FK column and format for output.
   */
  private formatFavorite(row: typeof favorites.$inferSelect) {
    let entityType: FavoriteEntityType;
    if (row.projectId) entityType = "project";
    else if (row.issueId) entityType = "issue";
    else if (row.pageId) entityType = "page";
    else if (row.spaceId) entityType = "space";
    else entityType = "project"; // fallback — should not happen

    return {
      id: row.id,
      userId: row.userId,
      projectId: row.projectId,
      issueId: row.issueId,
      pageId: row.pageId,
      spaceId: row.spaceId,
      entityType,
      entityName: "Unknown",
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Format a favorite row with resolved entity name from a joined query.
   */
  private formatFavoriteWithName(row: {
    favorite: typeof favorites.$inferSelect;
    projectName: string | null;
    issueName: string | null;
    pageName: string | null;
    spaceName: string | null;
  }) {
    const fav = row.favorite;
    let entityType: FavoriteEntityType;
    let entityName: string;

    if (fav.projectId) {
      entityType = "project";
      entityName = row.projectName ?? "Unknown";
    } else if (fav.issueId) {
      entityType = "issue";
      entityName = row.issueName ?? "Unknown";
    } else if (fav.pageId) {
      entityType = "page";
      entityName = row.pageName ?? "Unknown";
    } else if (fav.spaceId) {
      entityType = "space";
      entityName = row.spaceName ?? "Unknown";
    } else {
      entityType = "project";
      entityName = "Unknown";
    }

    return {
      id: fav.id,
      userId: fav.userId,
      projectId: fav.projectId,
      issueId: fav.issueId,
      pageId: fav.pageId,
      spaceId: fav.spaceId,
      entityType,
      entityName,
      sortOrder: fav.sortOrder,
      createdAt: fav.createdAt.toISOString(),
    };
  }
}
