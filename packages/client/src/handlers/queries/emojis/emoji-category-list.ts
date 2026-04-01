import { ChangeCheckResult, QueryHandler } from '@worknest/client/lib/types';
import { EmojiCategoryListQueryInput } from '@worknest/client/queries/emojis/emoji-category-list';
import { AppService } from '@worknest/client/services/app-service';
import { EmojiCategory } from '@worknest/client/types/emojis';
import { Event } from '@worknest/client/types/events';

export class EmojiCategoryListQueryHandler
  implements QueryHandler<EmojiCategoryListQueryInput>
{
  private readonly app: AppService;

  constructor(app: AppService) {
    this.app = app;
  }

  public async handleQuery(
    _: EmojiCategoryListQueryInput
  ): Promise<EmojiCategory[]> {
    if (!this.app.assets.emojis) {
      return [];
    }

    const data = this.app.assets.emojis
      .selectFrom('categories')
      .selectAll()
      .execute();

    return data;
  }

  public async checkForChanges(
    _: Event,
    __: EmojiCategoryListQueryInput,
    ___: EmojiCategory[]
  ): Promise<ChangeCheckResult<EmojiCategoryListQueryInput>> {
    return {
      hasChanges: false,
    };
  }
}
