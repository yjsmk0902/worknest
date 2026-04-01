import { Emoji } from '@worknest/client/types';
import { EmojiElement } from '@worknest/ui/components/emojis/emoji-element';
import { useEmojiPicker } from '@worknest/ui/contexts/emoji-picker';

interface EmojiPickerItemProps {
  emoji: Emoji;
}

export const EmojiPickerItem = ({ emoji }: EmojiPickerItemProps) => {
  const { skinTone, onPick: onEmojiClick } = useEmojiPicker();

  const skin = emoji.skins[skinTone];
  const id = skin?.id ?? emoji.skins[0]?.id ?? '';

  if (!id) {
    return null;
  }

  return (
    <button
      className="p-1 ring-border transition-colors duration-100 ease-in-out hover:bg-accent focus:border-border focus:outline-none focus:ring cursor-pointer"
      onClick={() => onEmojiClick(emoji)}
    >
      <EmojiElement className="h-5 w-5" id={id} />
    </button>
  );
};
