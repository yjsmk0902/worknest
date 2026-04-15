import { type ConnectionOptions, type Job, Queue, Worker } from 'bullmq';

// ── Types ──────────────────────────────────────────────────────────────

export type JobProcessor<T = unknown> = (job: Job<T>) => Promise<void>;

interface JobRegistration {
  name: string;
  processor: JobProcessor;
}

// ── Queue Manager ──────────────────────────────────────────────────────

const QUEUE_NAME = 'worknest';

let queue: Queue | null = null;
let worker: Worker | null = null;
const processors = new Map<string, JobProcessor>();

/**
 * Get the Redis connection options for BullMQ from environment.
 */
function getConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    username: parsed.username || undefined,
  };
}

/**
 * Initialize the BullMQ queue. Call once at startup.
 */
export function initQueue(): Queue {
  if (queue) return queue;

  const connection = getConnectionOptions();

  queue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return queue;
}

/**
 * Register a named job processor. Must be called before `startWorker()`.
 */
export function registerProcessor(registration: JobRegistration): void {
  processors.set(registration.name, registration.processor);
}

/**
 * Start the BullMQ worker that dispatches jobs to registered processors.
 */
export function startWorker(): Worker {
  if (worker) return worker;

  const connection = getConnectionOptions();

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const processor = processors.get(job.name);
      if (!processor) {
        throw new Error(`No processor registered for job: ${job.name}`);
      }
      await processor(job);
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.name}[${job?.id}] failed:`, error.message);
  });

  return worker;
}

/**
 * Add a job to the queue.
 */
export async function addJob<T>(
  name: string,
  data: T,
  opts?: {
    delay?: number;
    priority?: number;
    repeat?: { every: number } | { pattern: string };
  },
): Promise<void> {
  const q = initQueue();
  await q.add(name, data, opts);
}

/**
 * Gracefully close queue and worker.
 */
export async function closeQueue(): Promise<void> {
  await Promise.all([worker?.close(), queue?.close()]);
  worker = null;
  queue = null;
}
