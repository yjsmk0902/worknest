import { useState } from 'react';

import { EmojiElement } from '@worknest/ui/components/emojis/emoji-element';
import { Button } from '@worknest/ui/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@worknest/ui/components/ui/popover';
import { useQuery } from '@worknest/ui/hooks/use-query';
import { defaultEmojis } from '@worknest/ui/lib/assets';

interface EmojiSkinToneSelectorProps {
  skinTone: number;
  onSkinToneChange: (skinTone: number) => void;
}

export const EmojiSkinToneSelector = ({
  skinTone,
  onSkinToneChange,
}: EmojiSkinToneSelectorProps) => {
  const [open, setOpen] = useState<boolean>(false);

  const emojiGetQuery = useQuery({
    type: 'emoji.get',
    id: defaultEmojis.hand,
  });

  const handleSkinToneSelection = (skinTone: number) => {
    setOpen(false);
    onSkinToneChange?.(skinTone);
  };

  if (emojiGetQuery.isPending || !emojiGetQuery.data) {
    return null;
  }

  const emoji = emojiGetQuery.data;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="outline" className="p-2">
          <EmojiElement
            id={emoji.skins[skinTone || 0]?.id ?? ''}
            className="h-full w-full"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-row gap-1 p-1 w-60">
        {emoji.skins.map((skin, idx) => (
          <Button
            key={`skin-selector-${skin.id}`}
            size="icon"
            variant="ghost"
            onClick={() => handleSkinToneSelection(idx)}
            className="size-8 p-1"
          >
            <EmojiElement id={skin.id} className="h-full w-full" />
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
