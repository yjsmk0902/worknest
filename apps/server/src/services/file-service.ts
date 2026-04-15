import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type Database,
  files,
  issues,
  projectMembers,
  wikiPages,
  wikiSpaceMembers,
} from '@worknest/db';
import { and, eq, isNull } from 'drizzle-orm';
import { AppError, ErrorCode } from '../lib/errors';
import { addJob } from '../lib/queue';

// ── Constants ──────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const BLOCKED_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.ps1']);
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Ensure the uploads directory exists.
 */
function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Generate a unique filename preserving the original extension.
 */
function generateFilePath(originalName: string): string {
  const ext = path.extname(originalName);
  const uniqueId = crypto.randomUUID();
  return path.join(UPLOADS_DIR, `${uniqueId}${ext}`);
}

/**
 * Detect if a file is an image by its MIME type.
 */
function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// ── Serialisation ──────────────────────────────────────────────────────

function toFileOutput(row: typeof files.$inferSelect) {
  return {
    id: row.id,
    issueId: row.issueId ?? null,
    pageId: row.pageId ?? null,
    name: row.name,
    path: `/api/v1/files/${row.id}/download`,
    mimeType: row.mimeType,
    size: row.size,
    uploadedBy: row.uploadedBy ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Service ────────────────────────────────────────────────────────────

export class FileService {
  constructor(private db: Database) {}

  // ── Auth Helpers ────────────────────────────────────────────────

  /**
   * Verify that the caller has access to the file's parent entity.
   * - If file is attached to a page: verify wiki space membership.
   * - If file is attached to an issue: verify project membership.
   * - Otherwise: verify uploader.
   */
  private async requireFileAccess(
    file: typeof files.$inferSelect,
    callerUserId: string,
  ): Promise<void> {
    if (file.pageId) {
      await this.requirePageAccess(file.pageId, callerUserId);
    } else if (file.issueId) {
      await this.requireIssueAccess(file.issueId, callerUserId);
    } else {
      // No parent entity — only the uploader can access
      if (file.uploadedBy !== callerUserId) {
        throw AppError.forbidden('You do not have permission to access this file');
      }
    }
  }

  /**
   * Verify the caller is a member of the wiki space that owns this page.
   */
  private async requirePageAccess(pageId: string, callerUserId: string): Promise<void> {
    const page = await this.db
      .select({ wikiSpaceId: wikiPages.wikiSpaceId })
      .from(wikiPages)
      .where(eq(wikiPages.id, pageId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!page) {
      throw AppError.notFound('wiki_page');
    }

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

    if (!member) {
      throw AppError.forbidden('You are not a member of this wiki space');
    }
  }

  /**
   * Verify the caller is a member of the project that owns this issue.
   */
  private async requireIssueAccess(issueId: string, callerUserId: string): Promise<void> {
    const issue = await this.db
      .select({ projectId: issues.projectId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!issue) {
      throw AppError.notFound('issue');
    }

    const member = await this.db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, issue.projectId), eq(projectMembers.userId, callerUserId)),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (!member) {
      throw AppError.forbidden('You are not a member of this project');
    }
  }

  // ── Upload File ──────────────────────────────────────────────────

  async upload(
    callerUserId: string,
    file: {
      filename: string;
      mimetype: string;
      data: Buffer;
    },
    entityType?: 'issue' | 'page',
    entityId?: string,
  ) {
    // Validate file size
    if (file.data.length > MAX_FILE_SIZE) {
      throw AppError.badRequest(
        ErrorCode.FILE_TOO_LARGE,
        'File size exceeds the maximum allowed size of 25MB',
      );
    }

    // Validate file extension
    const ext = path.extname(file.filename).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw AppError.badRequest(ErrorCode.FILE_TYPE_BLOCKED, `File type ${ext} is not allowed`);
    }

    // Validate that the referenced entity exists
    if (entityType === 'issue' && entityId) {
      const issue = await this.db
        .select({ id: issues.id })
        .from(issues)
        .where(and(eq(issues.id, entityId), isNull(issues.deletedAt)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!issue) {
        throw AppError.notFound('issue');
      }
    } else if (entityType === 'page' && entityId) {
      const page = await this.db
        .select({ id: wikiPages.id })
        .from(wikiPages)
        .where(and(eq(wikiPages.id, entityId), isNull(wikiPages.deletedAt)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!page) {
        throw AppError.notFound('wiki_page');
      }
    }

    // Write file to disk
    ensureUploadsDir();
    const filePath = generateFilePath(file.filename);
    fs.writeFileSync(filePath, file.data);

    // Insert DB record
    const issueId = entityType === 'issue' ? (entityId ?? null) : null;
    const pageId = entityType === 'page' ? (entityId ?? null) : null;

    const [record] = await this.db
      .insert(files)
      .values({
        issueId,
        pageId,
        name: file.filename,
        path: filePath,
        mimeType: file.mimetype,
        size: file.data.length,
        uploadedBy: callerUserId,
      })
      .returning();

    // Queue thumbnail generation for images
    if (isImage(file.mimetype)) {
      await addJob('image-thumbnail', {
        fileId: record?.id,
        filePath,
        mimeType: file.mimetype,
      });
    }

    return toFileOutput(record!);
  }

  // ── List Files by Page ──────────────────────────────────────

  async listByPageId(pageId: string, callerUserId: string) {
    await this.requirePageAccess(pageId, callerUserId);

    const rows = await this.db.select().from(files).where(eq(files.pageId, pageId));

    return {
      data: rows.map(toFileOutput),
      pagination: {
        next_cursor: null,
        has_more: false,
      },
    };
  }

  // ── Get File by ID ──────────────────────────────────────────────

  async getById(fileId: string, callerUserId: string) {
    const file = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!file) {
      throw AppError.notFound('file');
    }

    await this.requireFileAccess(file, callerUserId);

    return toFileOutput(file);
  }

  // ── Get File record (internal, includes raw path) ───────────────

  async getFileRecord(fileId: string, callerUserId: string) {
    const file = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!file) {
      throw AppError.notFound('file');
    }

    await this.requireFileAccess(file, callerUserId);

    return file;
  }

  // ── Get File record (public, no auth check) ─────────────────────

  async getFileRecordPublic(fileId: string) {
    const file = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!file) {
      throw AppError.notFound('file');
    }

    return file;
  }

  // ── Delete File ─────────────────────────────────────────────────

  async delete(fileId: string, callerUserId: string) {
    const file = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!file) {
      throw AppError.notFound('file');
    }

    // Only the uploader can delete
    if (file.uploadedBy !== callerUserId) {
      throw AppError.forbidden('You can only delete files you uploaded');
    }

    // Delete from disk
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      // Also try to delete thumbnail if it exists
      const thumbnailPath = file.path.replace(/(\.[^.]+)$/, '.thumb.webp');
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    } catch {
      // Non-fatal: log but continue with DB deletion
    }

    // Delete from DB
    await this.db.delete(files).where(eq(files.id, fileId));
  }
}
