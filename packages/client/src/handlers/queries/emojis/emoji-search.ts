import { mapEmoji } from '@worknest/client/lib/mappers';
import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { EmojiSearchQueryInput } from '@worknest/client/queries/emojis/emoji-search';
import { AppService } from '@worknest/client/services/app-service';
import { Emoji } from '@worknest/client/types/emojis';

export class EmojiSearchQueryHandler
  implements QueryHandler<EmojiSearchQueryInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(input: EmojiSearchQueryInput): Promise<Emoji[]> {
    if (!this.app.assets.emojis) {
      return [];
    }

    const data = await this.app.assets.emojis
      .selectFrom('emojis')
      .innerJoin('emoji_search', 'emojis.id', 'emoji_search.id')
      .selectAll('emojis')
      .where('emoji_search.text', 'match', `${input.query}*`)
      .limit(input.count)
      .execute();

    const emojis: Emoji[] = data.map(mapEmoji);
    return emojis;
  }

  public async checkForChanges(): Promise<
    ChangeCheckResult<EmojiSearchQueryInput>
  > {
    return {
      hasChanges: false,
    };
  }
}
