import dotenv from 'dotenv';

import { initApp } from '@worknest/server/app';
import { migrate } from '@worknest/server/data/database';
import { initRedis } from '@worknest/server/data/redis';
import { eventBus } from '@worknest/server/lib/event-bus';
import { emailService } from '@worknest/server/services/email-service';
import { jobService } from '@worknest/server/services/job-service';

dotenv.config({
  quiet: true,
});

const init = async () => {
  await migrate();
  await initRedis();

  initApp();

  await jobService.initQueue();
  await jobService.initWorker();

  await eventBus.init();
  await emailService.init();
};

init();
