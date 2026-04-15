import { type KeyboardEvent, forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface MentionUser {
  /** Unique user ID */
  id: string;
  /** Display name */
  name: string;
  /** Avatar URL (optional) */
  avatarUrl?: string;
  /** Email (optional, for display) */
  email?: string;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface MentionListProps {
  items: MentionUser[];
  command: (attrs: { id: string; label: string }) => void;
}

/**
 * Dropdown component for @mention suggestions.
 *
 * Renders a list of users with avatars, supports keyboard navigation
 * (ArrowUp, ArrowDown, Enter) and mouse selection.
 */
export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.name });
      }
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-2 text-sm text-muted-foreground">
          No results
        </div>
      );
    }

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md overflow-hidden max-h-[280px] overflow-y-auto">
        {items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={[
              'flex items-center gap-2 w-full px-3 py-2 text-sm text-left',
              'hover:bg-accent transition-colors',
              index === selectedIndex ? 'bg-accent' : '',
            ].join(' ')}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt={item.name}
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {item.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{item.name}</span>
              {item.email && (
                <span className="text-xs text-muted-foreground truncate">{item.email}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  },
);

MentionList.displayName = 'MentionList';
