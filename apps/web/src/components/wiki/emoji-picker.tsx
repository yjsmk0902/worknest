import { Popover, PopoverContent, PopoverTrigger } from '@worknest/ui';
import { useState } from 'react';

// Curated set of common page emojis, organised loosely by theme.
const EMOJI_GROUPS: Array<{ label: string; items: string[] }> = [
  {
    label: '문서',
    items: ['📄', '📃', '📑', '📋', '📝', '📒', '📓', '📔', '📕', '📗', '📘', '📙', '📚', '📖'],
  },
  {
    label: '작업',
    items: ['✅', '☑️', '📌', '📍', '🔖', '🏷️', '🗂️', '🗃️', '🗄️', '📁', '📂', '🎯', '🚀', '⚙️'],
  },
  {
    label: '아이디어',
    items: ['💡', '✨', '🧠', '🔍', '🔎', '🔬', '🧪', '🧩', '🎨', '🖌️', '🖍️', '📐', '📏', '🖇️'],
  },
  {
    label: '커뮤니케이션',
    items: ['💬', '🗨️', '📣', '📢', '📞', '☎️', '📧', '💌', '📨', '📤', '📥', '📡', '📺', '📻'],
  },
  {
    label: '사람/팀',
    items: ['👥', '👤', '🤝', '👋', '🙋', '💼', '🎓', '⭐', '🏆', '🥇', '🎉', '🎊', '🎁', '❤️'],
  },
  {
    label: '기호',
    items: ['🔥', '⚡', '🌟', '🔔', '⏰', '⏳', '🔒', '🔑', '🛡️', '⚠️', '❗', '❓', '✔️', '➡️'],
  },
];

interface EmojiPickerProps {
  /** Currently selected emoji. `null` means "no icon". */
  value: string | null;
  /** Called with emoji string or `null` (when removed). */
  onChange: (emoji: string | null) => void;
  children: React.ReactNode;
}

export function EmojiPicker({ value, onChange, children }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[320px] p-2 bg-[color:var(--bg-1)] border-[color:var(--border)]"
      >
        <div className="max-h-[340px] overflow-y-auto">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-[color:var(--fg-4)]">
                {group.label}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {group.items.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`grid h-8 w-8 place-items-center rounded text-[18px] transition-colors hover:bg-[color:var(--bg-3)] ${
                      value === emoji ? 'bg-[color:var(--bg-3)]' : ''
                    }`}
                    onClick={() => {
                      onChange(emoji);
                      setOpen(false);
                    }}
                    aria-label={`이모지 ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {value && (
          <div className="mt-2 border-t border-[color:var(--border-subtle)] pt-2">
            <button
              type="button"
              className="w-full rounded px-2 py-1.5 text-left text-[12.5px] text-[color:var(--fg-3)] transition-colors hover:bg-[color:var(--bg-3)] hover:text-[color:var(--fg-1)]"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              아이콘 제거
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
