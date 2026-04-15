import { ALLOWED_EMOJIS } from '@worknest/shared';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@worknest/ui';
import { SmilePlus } from 'lucide-react';
import { useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────

interface ReactionData {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

interface ReactionsProps {
  /** All reaction records for this comment */
  reactions: ReactionData[];
  /** Current user ID to determine self-reactions */
  currentUserId: string;
  /** Called when a reaction is toggled */
  onToggle: (emoji: string) => void;
}

// ── Grouped reaction type ──────────────────────────────────────────────

interface GroupedReaction {
  emoji: string;
  count: number;
  users: { id: string; name: string }[];
  selfReacted: boolean;
}

function groupReactions(reactions: ReactionData[], currentUserId: string): GroupedReaction[] {
  const map = new Map<string, GroupedReaction>();

  for (const r of reactions) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count += 1;
      if (r.user) existing.users.push({ id: r.user.id, name: r.user.name });
      if (r.userId === currentUserId) existing.selfReacted = true;
    } else {
      map.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        users: r.user ? [{ id: r.user.id, name: r.user.name }] : [],
        selfReacted: r.userId === currentUserId,
      });
    }
  }

  return Array.from(map.values());
}

// ── Emoji Picker Popover ───────────────────────────────────────────────

function EmojiPicker({
  onSelect,
  selfReactedEmojis,
}: {
  onSelect: (emoji: string) => void;
  selfReactedEmojis: Set<string>;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 p-2" role="grid" aria-label="이모지 선택">
      {ALLOWED_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className={cn(
            'flex w-9 h-9 items-center justify-center rounded-md text-lg cursor-pointer hover:bg-accent transition-colors',
            selfReactedEmojis.has(emoji) && 'bg-primary/10',
          )}
          aria-label={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ── Reaction Pill ──────────────────────────────────────────────────────

function ReactionPill({
  group,
  onToggle,
}: {
  group: GroupedReaction;
  onToggle: (emoji: string) => void;
}) {
  const tooltipText = (() => {
    const names = group.users.slice(0, 5).map((u) => u.name);
    const remaining = group.users.length - 5;
    if (remaining > 0) {
      return `${names.join(', ')} +${remaining}명`;
    }
    return names.join(', ');
  })();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onToggle(group.emoji)}
          aria-label={`${group.emoji} ${group.count}개 리액션`}
          className={cn(
            'inline-flex h-6 cursor-pointer items-center gap-1 rounded-full px-2 text-xs transition-colors',
            group.selfReacted
              ? 'border border-primary/30 bg-primary/10 font-medium hover:bg-primary/15'
              : 'border border-transparent bg-muted hover:bg-muted/80',
          )}
        >
          <span>{group.emoji}</span>
          <span>{group.count}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Reactions Component ────────────────────────────────────────────────

export function Reactions({ reactions, currentUserId, onToggle }: ReactionsProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const grouped = groupReactions(reactions, currentUserId);

  const selfReactedEmojis = new Set(grouped.filter((g) => g.selfReacted).map((g) => g.emoji));

  const handleEmojiSelect = (emoji: string) => {
    onToggle(emoji);
    setPopoverOpen(false);
  };

  // Show nothing if no reactions and not hovering (the add button is shown on parent hover)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {grouped.map((group) => (
        <ReactionPill key={group.emoji} group={group} onToggle={onToggle} />
      ))}

      {/* Add reaction button */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full transition-colors',
              grouped.length > 0
                ? 'bg-muted/50 hover:bg-muted'
                : 'opacity-0 group-hover:opacity-100 bg-muted/50 hover:bg-muted',
            )}
            aria-label="리액션 추가"
          >
            <SmilePlus size={14} className="text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-0" align="start" side="top">
          <EmojiPicker onSelect={handleEmojiSelect} selfReactedEmojis={selfReactedEmojis} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
