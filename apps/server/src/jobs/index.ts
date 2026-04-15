import type { Database } from '@worknest/db';
import { registerProcessor } from '../lib/queue';
import { createBulkActivityProcessor } from './bulk-activity';
import { createHardDeleteCleanupProcessor } from './hard-delete-cleanup';
import { createImageThumbnailProcessor } from './image-thumbnail';
import { createNotificationProcessor } from './notification-job';
import { createOrphanCleanupProcessor } from './orphan-cleanup';

/**
 * Job processor registry.
 *
 * Register all BullMQ job processors. Must be called before `startWorker()`.
 */
export function registerAllJobs(db: Database): void {
  registerProcessor({
    name: 'bulk-activity',
    processor: createBulkActivityProcessor(db),
  });
  registerProcessor({
    name: 'image-thumbnail',
    processor: createImageThumbnailProcessor(),
  });
  registerProcessor({
    name: 'orphan-cleanup',
    processor: createOrphanCleanupProcessor(db),
  });
  registerProcessor({
    name: 'notification',
    processor: createNotificationProcessor(db),
  });
  registerProcessor({
    name: 'hard-delete-cleanup',
    processor: createHardDeleteCleanupProcessor(db),
  });
}
