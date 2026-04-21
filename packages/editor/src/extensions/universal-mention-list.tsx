import { FileText, Hash, User } from 'lucide-react';
import { type KeyboardEvent, forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export type UniversalMentionKind = 'user' | 'page' | 'issue';

export interface UniversalMentionItem {
  kind: UniversalMentionKind;
  id: string;
  label: string;
  subtitle?: string;
  icon?: string | null; // emoji for pages
  avatarUrl?: string | null; // user avatar
  /** Optional extra fields used to build the inline node */
  spaceId?: string;
  projectId?: string;
  projectPrefix?: string;
  sequenceId?: number;
}

export interface UniversalMentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface UniversalMentionListProps {
  items: UniversalMentionItem[];
  command: (item: UniversalMentionItem) => void;
}

const SECTION_LABEL: Record<UniversalMentionKind, string> = {
  user: '멤버',
  page: '위키 페이지',
  issue: '이슈',
};

export const UniversalMentionList = forwardRef<
  UniversalMentionListRef,
  UniversalMentionListProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      const ne = event as unknown as globalThis.KeyboardEvent;
      if (ne.isComposing || ne.keyCode === 229) return false;
      if (event.key === 'ArrowUp') {
        setSelectedIndex((p) => (p <= 0 ? items.length - 1 : p - 1));
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((p) => (p >= items.length - 1 ? 0 : p + 1));
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
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-2 text-sm text-muted-foreground w-[320px]">
        결과 없음
      </div>
    );
  }

  // Group while preserving order (stable within each kind).
  const sections = new Map<UniversalMentionKind, { item: UniversalMentionItem; flatIndex: number }[]>();
  items.forEach((item, idx) => {
    const list = sections.get(item.kind) ?? [];
    list.push({ item, flatIndex: idx });
    sections.set(item.kind, list);
  });

  const KIND_ORDER: UniversalMentionKind[] = ['user', 'page', 'issue'];

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md overflow-hidden max-h-[320px] w-[320px] overflow-y-auto">
      {KIND_ORDER.filter((k) => sections.has(k)).map((kind) => (
        <div key={kind}>
          <div className="px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-wider text-[color:var(--fg-4)] bg-[color:var(--bg-3)]/40">
            {SECTION_LABEL[kind]}
          </div>
          {sections.get(kind)!.map(({ item, flatIndex }) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              ref={(el) => {
                if (flatIndex === selectedIndex && el) {
                  el.scrollIntoView({ block: 'nearest' });
                }
              }}
              className={[
                'flex items-center gap-2 w-full h-9 px-3 text-left text-[13px]',
                'transition-colors',
                flatIndex === selectedIndex
                  ? 'bg-[color:var(--bg-3)] text-[color:var(--fg-1)]'
                  : 'hover:bg-[color:var(--bg-2)] text-[color:var(--fg-2)]',
              ].join(' ')}
              onClick={() => selectItem(flatIndex)}
              onMouseEnter={() => setSelectedIndex(flatIndex)}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center text-[13px]">
                {item.kind === 'user' &&
                  (item.avatarUrl ? (
                    <img
                      src={item.avatarUrl}
                      alt=""
                      className="h-5 w-5 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-3.5 w-3.5 text-[color:var(--fg-3)]" />
                  ))}
                {item.kind === 'page' &&
                  (item.icon ? (
                    <span>{item.icon}</span>
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-[color:var(--fg-3)]" />
                  ))}
                {item.kind === 'issue' && (
                  <Hash className="h-3.5 w-3.5 text-[color:var(--fg-3)]" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
              {item.subtitle && (
                <span className="ml-auto shrink-0 truncate text-[11.5px] text-[color:var(--fg-4)]">
                  {item.subtitle}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
});

UniversalMentionList.displayName = 'UniversalMentionList';
