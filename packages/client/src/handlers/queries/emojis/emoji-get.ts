import { mapEmoji } from '@worknest/client/lib/mappers';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { EmojiGetQueryInput } from '@worknest/client/queries/emojis/emoji-get';
import { AppService } from '@worknest/client/services/app-service';
import { Emoji } from '@worknest/client/types/emojis';
import { Event } from '@worknest/client/types/events';

export class EmojiGetQueryHandler implements QueryHandler<EmojiGetQueryInput> {
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(input: EmojiGetQueryInput): Promise<Emoji | null> {
    if (!this.app.assets.emojis) {
      return null;
    }

    const data = await this.app.assets.emojis
      .selectFrom('emojis')
      .selectAll()
      .where('id', '=', input.id)
      .executeTakeFirst();

    if (!data) {
      return null;
    }

    const emoji = mapEmoji(data);
    return emoji;
  }

  public async checkForChanges(
    _: Event,
    __: EmojiGetQueryInput,
    ___: Emoji | null
  ): Promise<ChangeCheckResult<EmojiGetQueryInput>> {
    return {
      hasChanges: false,
    };
  }
}
