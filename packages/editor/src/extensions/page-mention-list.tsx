import { FileText } from 'lucide-react';
import { type KeyboardEvent, forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface PageMentionItem {
  /** Wiki page ID */
  id: string;
  /** Page title */
  title: string;
  /** Optional emoji icon */
  icon: string | null;
  /** Space name for subtitle */
  spaceName: string;
  /** Space ID (used by consumer to build URL) */
  spaceId: string;
}

export interface PageMentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface PageMentionListProps {
  items: PageMentionItem[];
  command: (attrs: { id: string; label: string; spaceId: string; icon: string | null }) => void;
}

export const PageMentionList = forwardRef<PageMentionListRef, PageMentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.title, spaceId: item.spaceId, icon: item.icon });
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
          페이지 없음
        </div>
      );
    }

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md overflow-hidden max-h-[280px] w-[320px] overflow-y-auto">
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
            <span className="grid h-5 w-5 shrink-0 place-items-center text-[14px] leading-none">
              {item.icon ?? <FileText className="h-[13px] w-[13px] text-muted-foreground" />}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="font-medium truncate">{item.title || '제목 없음'}</span>
              {item.spaceName && (
                <span className="text-xs text-muted-foreground truncate">{item.spaceName}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  },
);

PageMentionList.displayName = 'PageMentionList';
