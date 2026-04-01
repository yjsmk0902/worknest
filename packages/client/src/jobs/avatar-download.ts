import ms from 'ms';

import {
  JobHandler,
  JobOutput,
  JobConcurrencyConfig,
} from '@worknest/client/jobs';
import { AppService } from '@worknest/client/services/app-service';

export type AvatarDownloadInput = {
  type: 'avatar.download';
  accountId: string;
  avatar: string;
};

declare module '@worknest/client/jobs' {
  interface JobMap {
    'avatar.download': {
      input: AvatarDownloadInput;
    };
  }
}

export class AvatarDownloadJobHandler
  implements JobHandler<AvatarDownloadInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public readonly concurrency: JobConcurrencyConfig<AvatarDownloadInput> = {
    limit: 1,
    key: (input: AvatarDownloadInput) => `avatar.download.${input.avatar}`,
  };

  public async handleJob(input: AvatarDownloadInput): Promise<JobOutput> {
    const account = this.app.getAccount(input.accountId);
    if (!account) {
      return {
        type: 'cancel',
      };
    }

    const result = await this.app.assets.downloadAvatar(
      account.id,
      input.avatar
    );
    if (result === null) {
      return {
        type: 'retry',
        delay: ms('1 minute'),
      };
    }

    if (!result) {
      return {
        type: 'cancel',
      };
    }

    return {
      type: 'success',
    };
  }
}
