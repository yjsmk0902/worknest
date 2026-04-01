import { EmojiPickerItemsRow } from '@worknest/client/types';
import { EmojiPickerItem } from '@worknest/ui/components/emojis/emoji-picker-item';
import { useQuery } from '@worknest/ui/hooks/use-query';

interface EmojiBrowserItemsProps {
  row: EmojiPickerItemsRow;
  style: React.CSSProperties;
}

export const EmojiBrowserItems = ({ row, style }: EmojiBrowserItemsProps) => {
  const emojiListQuery = useQuery({
    type: 'emoji.list',
    category: row.category,
    page: row.page,
    count: row.count,
  });

  const emojis = emojiListQuery.data ?? [];
  return (
    <div className="flex flex-row gap-1" style={style}>
      {emojis.map((emoji) => (
        <EmojiPickerItem key={emoji.id} emoji={emoji} />
      ))}
    </div>
  );
};
