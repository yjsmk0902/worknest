import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { AvatarGetQueryInput } from '@worknest/client/queries/avatars/avatar-get';
import { AppService } from '@worknest/client/services/app-service';
import { Avatar } from '@worknest/client/types/avatars';
import { Event } from '@worknest/client/types/events';

export class AvatarGetQueryHandler
  implements QueryHandler<AvatarGetQueryInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(input: AvatarGetQueryInput): Promise<Avatar | null> {
    const account = this.app.getAccount(input.accountId);
    if (!account) {
      return null;
    }

    return this.app.assets.getAvatar(account.id, input.avatarId, true);
  }

  public async checkForChanges(
    event: Event,
    input: AvatarGetQueryInput
  ): Promise<ChangeCheckResult<AvatarGetQueryInput>> {
    if (event.type === 'avatar.created' && event.avatar.id === input.avatarId) {
      return {
        hasChanges: true,
        result: event.avatar,
      };
    }

    if (event.type === 'avatar.deleted' && event.avatar.id === input.avatarId) {
      return {
        hasChanges: true,
        result: null,
      };
    }

    return {
      hasChanges: false,
    };
  }
}
