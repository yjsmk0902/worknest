/**
 * Backfill auto-wiki spaces for pre-existing projects.
 *
 * As of 2026-04-21 every new project gets a linked wiki space created in the
 * same transaction as the project. Projects created before that date have no
 * `wiki_spaces` row with `project_id = <project.id>`, so the sidebar/top menu
 * "위키" entry silently points nowhere.
 *
 * This script walks every non-deleted project, skips those that already have
 * a linked wiki space, and creates one + an editor-role `wiki_space_members`
 * row for the first available project admin (fallback: any project member).
 *
 * Run with:
 *   pnpm --filter @worknest/server tsx scripts/backfill-project-wikis.ts
 *
 * Environment: DATABASE_URL must be set. Pass `--dry-run` to preview only.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  createDb,
  projectMembers,
  projects,
  wikiSpaceMembers,
  wikiSpaces,
} from '@worknest/db';
import { and, asc, eq, isNull } from 'drizzle-orm';

// Load env from the monorepo root (two levels up from apps/server/scripts).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config(); // also pick up apps/server/.env or process env, if present

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const { db, client } = createDb();
  let created = 0;
  let skipped = 0;
  let orphaned = 0;

  try {
    const activeProjects = await db
      .select()
      .from(projects)
      .where(isNull(projects.deletedAt));

    console.log(`[backfill] scanning ${activeProjects.length} projects...`);

    for (const project of activeProjects) {
      const [existing] = await db
        .select({ id: wikiSpaces.id })
        .from(wikiSpaces)
        .where(eq(wikiSpaces.projectId, project.id))
        .limit(1);

      if (existing) {
        skipped += 1;
        continue;
      }

      const firstAdmin = await db
        .select({ userId: projectMembers.userId, role: projectMembers.role })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, project.id))
        .orderBy(asc(projectMembers.joinedAt));

      const owner =
        firstAdmin.find((m) => m.role === 'admin')?.userId ??
        firstAdmin[0]?.userId ??
        null;

      if (!owner) {
        console.warn(
          `[backfill] project ${project.id} (${project.prefix}) has no members — skipping`,
        );
        orphaned += 1;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `[backfill] (dry) would create wiki for project ${project.prefix} (${project.name}) owner=${owner}`,
        );
        created += 1;
        continue;
      }

      const slug = await pickAvailableSlug(
        db,
        project.workspaceId,
        `proj-${project.prefix.toLowerCase()}`,
      );

      await db.transaction(async (tx) => {
        const [space] = await tx
          .insert(wikiSpaces)
          .values({
            workspaceId: project.workspaceId,
            projectId: project.id,
            createdBy: owner,
            name: `${project.name} 위키`,
            description: null,
            slug,
          })
          .returning();

        if (space?.id) {
          await tx.insert(wikiSpaceMembers).values({
            wikiSpaceId: space.id,
            userId: owner,
            role: 'editor',
          });
        }
      });

      created += 1;
      console.log(
        `[backfill] created wiki for ${project.prefix} (${project.name}) slug=${slug}`,
      );
    }

    console.log(
      `[backfill] done. created=${created} skipped=${skipped} orphaned=${orphaned}${
        DRY_RUN ? ' (dry-run)' : ''
      }`,
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function pickAvailableSlug(
  db: ReturnType<typeof createDb>['db'],
  workspaceId: string,
  base: string,
): Promise<string> {
  const [clash] = await db
    .select({ id: wikiSpaces.id })
    .from(wikiSpaces)
    .where(and(eq(wikiSpaces.workspaceId, workspaceId), eq(wikiSpaces.slug, base)))
    .limit(1);
  if (!clash) return base;
  // Fall back to a suffixed slug so we never collide with a manually-created space.
  return `${base}-${Date.now().toString(36).slice(-6)}`;
}

main().catch((err) => {
  console.error('[backfill] failed:', err);
  process.exit(1);
});
