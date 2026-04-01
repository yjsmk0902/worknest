import logger from 'pino';

import { config } from '@worknest/server/lib/config';

export const createLogger = (name: string) => {
  const level = config.logging.level;

  return logger({
    level,
    name,
  });
};
