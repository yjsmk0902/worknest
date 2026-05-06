/**
 * Backfill default issue templates for pre-existing projects.
 *
 * As of 2026-04-29 every new project gets three default templates seeded
 * (버그 리포트, 기능 요청, 작업) in the same transaction as project creation.
 * Projects created before that date have no rows in `issue_templates`.
 *
 * This script walks every non-deleted project, looks up its issue types by
 * name, and inserts the missing default templates. Projects that already
 * have any default-flagged template are skipped (no double-seeding).
 *
 * Run with:
 *   pnpm --filter @worknest/server tsx scripts/backfill-issue-templates.ts
 *
 * Environment: DATABASE_URL must be set. Pass `--dry-run` to preview only.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDb, issueTemplates, issueTypes, projects } from '@worknest/db';
import dotenv from 'dotenv';
import { eq, isNull } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const DEFAULT_TEMPLATES: Array<{
  name: string;
  description: string;
  titleTemplate: string;
  body: unknown;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none';
  typeName: string | null;
  sortOrder: number;
}> = [
  {
    name: '버그 리포트',
    description: '재현 절차/기대 결과/실제 결과를 담은 버그 보고용 템플릿',
    titleTemplate: '[버그] ',
    priority: 'high',
    typeName: '버그',
    sortOrder: 0,
    body: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '재현 절차' }] },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '...' }] }],
            },
          ],
        },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '기대 결과' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '실제 결과' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '환경' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'OS / 브라우저 / 버전' }] },
      ],
    },
  },
  {
    name: '기능 요청',
    description: '배경/제안/수용 기준을 담은 기능 요청용 템플릿',
    titleTemplate: '[기능] ',
    priority: 'medium',
    typeName: '스토리',
    sortOrder: 1,
    body: {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '배경' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '제안' }] },
        { type: 'paragraph' },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '수용 기준' }] },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '...' }] }],
            },
          ],
        },
      ],
    },
  },
  {
    name: '작업',
    description: '간단한 작업/할 일용 빈 템플릿',
    titleTemplate: '',
    priority: 'none',
    typeName: '작업',
    sortOrder: 2,
    body: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
  },
];

async function main() {
  const { db, client } = createDb();
  let seededProjects = 0;
  let skipped = 0;
  let inserted = 0;

  try {
    const activeProjects = await db.select().from(projects).where(isNull(projects.deletedAt));
    console.log(`[backfill-templates] scanning ${activeProjects.length} projects...`);

    for (const project of activeProjects) {
      const existing = await db
        .select({ id: issueTemplates.id, name: issueTemplates.name })
        .from(issueTemplates)
        .where(eq(issueTemplates.projectId, project.id))
        .limit(50);

      const existingNames = new Set(existing.map((e) => e.name));
      const missing = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name));

      if (missing.length === 0) {
        skipped += 1;
        continue;
      }

      const types = await db
        .select({ id: issueTypes.id, name: issueTypes.name })
        .from(issueTypes)
        .where(eq(issueTypes.projectId, project.id));
      const typeIdByName = new Map(types.map((t) => [t.name, t.id] as const));

      const rows = missing.map((t) => ({
        projectId: project.id,
        name: t.name,
        description: t.description,
        titleTemplate: t.titleTemplate,
        body: t.body as object,
        priority: t.priority,
        typeId: t.typeName ? (typeIdByName.get(t.typeName) ?? null) : null,
        labelIds: [] as string[],
        sortOrder: t.sortOrder,
        isDefault: true,
      }));

      console.log(
        `[backfill-templates] project ${project.prefix} (${project.id}): inserting ${rows.length} template(s)`,
      );

      if (!DRY_RUN) {
        await db.insert(issueTemplates).values(rows);
      }

      seededProjects += 1;
      inserted += rows.length;
    }

    console.log(
      `[backfill-templates] done. seededProjects=${seededProjects} totalInserted=${inserted} alreadyHasAll=${skipped} dryRun=${DRY_RUN}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[backfill-templates] failed:', err);
  process.exit(1);
});
