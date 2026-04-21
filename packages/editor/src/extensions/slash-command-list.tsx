import type { Editor, Range } from '@tiptap/core';
import {
  Bookmark as BookmarkIcon,
  ChevronRight,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Info,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Table,
} from 'lucide-react';
import {
  type KeyboardEvent,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

/** Props passed to each slash command's `command` callback. */
interface SlashCommandProps {
  editor: Editor;
  range: Range;
}

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: SlashCommandProps) => void;
  keywords: string[];
  category: string;
}

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

/** All available slash command blocks organized by category. */
export function getSlashCommandItems(): SlashCommandItem[] {
  return [
    // Text
    {
      title: '제목 1',
      description: '큰 섹션 제목',
      icon: <Heading1 size={18} />,
      keywords: ['heading1', 'h1', 'title'],
      category: '텍스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
      },
    },
    {
      title: '제목 2',
      description: '중간 섹션 제목',
      icon: <Heading2 size={18} />,
      keywords: ['heading2', 'h2'],
      category: '텍스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
      },
    },
    {
      title: '제목 3',
      description: '작은 섹션 제목',
      icon: <Heading3 size={18} />,
      keywords: ['heading3', 'h3'],
      category: '텍스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
      },
    },
    {
      title: '본문',
      description: '일반 텍스트',
      icon: <Pilcrow size={18} />,
      keywords: ['paragraph', 'text', 'plain'],
      category: '텍스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    // Lists
    {
      title: '글머리 기호',
      description: '순서 없는 리스트',
      icon: <List size={18} />,
      keywords: ['bullet', 'list', 'unordered'],
      category: '리스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: '번호 매기기',
      description: '순서 있는 리스트',
      icon: <ListOrdered size={18} />,
      keywords: ['numbered', 'ordered', 'ol'],
      category: '리스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: '체크리스트',
      description: '할 일 목록',
      icon: <ListTodo size={18} />,
      keywords: ['todo', 'checklist', 'task'],
      category: '리스트',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    // Media
    {
      title: '이미지',
      description: '이미지 업로드',
      icon: <Image size={18} />,
      keywords: ['image', 'img', 'picture', 'photo'],
      category: '미디어',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).run();
        // Trigger file input for image upload
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            // Dispatch custom event that the image-upload extension can handle
            const event = new CustomEvent('editor:image-upload', {
              detail: { file },
            });
            document.dispatchEvent(event);
          }
        };
        input.click();
      },
    },
    {
      title: '파일 첨부',
      description: '파일 업로드',
      icon: <Paperclip size={18} />,
      keywords: ['file', 'attachment', 'upload'],
      category: '미디어',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).run();
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const event = new CustomEvent('editor:file-upload', {
              detail: { file },
            });
            document.dispatchEvent(event);
          }
        };
        input.click();
      },
    },
    // Advanced
    {
      title: '코드 블록',
      description: '구문 강조 코드',
      icon: <Code2 size={18} />,
      keywords: ['code', 'codeblock', 'pre'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: '테이블',
      description: '행/열 테이블',
      icon: <Table size={18} />,
      keywords: ['table', 'grid'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: '인용구',
      description: '인용 텍스트',
      icon: <Quote size={18} />,
      keywords: ['quote', 'blockquote', 'cite'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: '콜아웃',
      description: '강조 박스 (이모지 + 배경)',
      icon: <Info size={18} />,
      keywords: ['callout', 'note', 'highlight', 'info'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: 'callout',
            attrs: { icon: '💡', color: 'info' },
            content: [{ type: 'paragraph' }],
          })
          .run();
      },
    },
    {
      title: '토글',
      description: '접히는 블록',
      icon: <ChevronRight size={18} />,
      keywords: ['toggle', 'details', 'collapse', 'expand'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: 'details',
            attrs: { open: true },
            content: [
              { type: 'detailsSummary' },
              { type: 'detailsContent', content: [{ type: 'paragraph' }] },
            ],
          })
          .run();
        // Defer selection change to next tick so Suggestion's menu-close
        // transaction (and any Enter-followup) settle first. Walking the
        // doc is more reliable than guessing a pos offset.
        requestAnimationFrame(() => {
          let summaryPos: number | null = null;
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === 'detailsSummary') {
              summaryPos = pos + 1;
            }
            return true;
          });
          if (summaryPos !== null) {
            editor.chain().setTextSelection(summaryPos).focus().run();
          }
        });
      },
    },
    {
      title: '구분선',
      description: '수평 구분선',
      icon: <Minus size={18} />,
      keywords: ['divider', 'hr', 'line', 'separator'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: '북마크',
      description: 'URL 미리보기 카드',
      icon: <BookmarkIcon size={18} />,
      keywords: ['bookmark', 'link', 'embed', 'url', 'preview'],
      category: '고급',
      command: ({ editor, range }: SlashCommandProps) => {
        // Delete the slash query text up front; open a React-owned modal to
        // collect the URL (dispatching a CustomEvent keeps this TipTap
        // extension decoupled from the consumer's UI).
        editor.chain().focus().deleteRange(range).run();

        const insertBookmark = (url: string) => {
          editor
            .chain()
            .focus()
            .insertContent({ type: 'bookmark', attrs: { url } })
            .run();

          fetch(`/api/v1/url-preview?url=${encodeURIComponent(url)}`, {
            credentials: 'include',
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((preview) => {
              if (!preview || typeof preview !== 'object') return;
              const { state } = editor;
              let bookmarkPos: number | null = null;
              state.doc.descendants((node, pos) => {
                if (
                  node.type.name === 'bookmark' &&
                  node.attrs.url === url &&
                  !node.attrs.title &&
                  !node.attrs.description
                ) {
                  bookmarkPos = pos;
                }
                return true;
              });
              if (bookmarkPos === null) return;
              editor
                .chain()
                .command(({ tr }) => {
                  tr.setNodeMarkup(bookmarkPos, undefined, {
                    url,
                    title: preview.title ?? null,
                    description: preview.description ?? null,
                    image: preview.image ?? null,
                    favicon: preview.favicon ?? null,
                    siteName: preview.siteName ?? null,
                  });
                  return true;
                })
                .run();
            })
            .catch(() => {
              // Silent — placeholder card stays with just the URL.
            });
        };

        window.dispatchEvent(
          new CustomEvent('editor:bookmark-prompt', {
            detail: { onSubmit: insertBookmark },
          }),
        );
      },
    },
  ];
}

/**
 * Floating menu component for slash commands.
 *
 * Shows categorized block types with search filtering
 * and keyboard navigation support.
 */
export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection only when the filtered item set actually changes
    // (not on every render — Suggestion passes a fresh array identity each
    // update, and resetting to 0 on every render swallowed ArrowDown presses).
    const itemsSignature = items.map((i) => i.title).join('|');
    // biome-ignore lint/correctness/useExhaustiveDependencies: items identity
    useEffect(() => {
      setSelectedIndex(0);
    }, [itemsSignature]);

    // Clamp selection when items shrink
    useEffect(() => {
      if (selectedIndex >= items.length && items.length > 0) {
        setSelectedIndex(items.length - 1);
      }
    }, [items.length, selectedIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        // Korean/Japanese/Chinese IME: first Enter commits composition —
        // don't treat it as item selection, let it pass to the IME.
        if (event.isComposing || event.keyCode === 229) {
          return false;
        }

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
        <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md p-3 text-sm text-muted-foreground w-[280px]">
          결과 없음
        </div>
      );
    }

    // Group items by category
    const grouped: Record<string, SlashCommandItem[]> = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    let flatIndex = 0;

    return (
      <div className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md overflow-hidden w-[280px] max-h-[320px] overflow-y-auto">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            {/* Category header */}
            <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
              {category}
            </div>
            {/* Items */}
            {categoryItems.map((item) => {
              const currentIndex = flatIndex++;
              const isSelected = currentIndex === selectedIndex;
              return (
                <button
                  type="button"
                  key={item.title}
                  ref={(el) => {
                    if (isSelected && el) {
                      el.scrollIntoView({ block: 'nearest' });
                    }
                  }}
                  className={[
                    'flex items-center gap-3 w-full h-10 px-3 text-left',
                    'transition-colors',
                    isSelected
                      ? 'bg-[color:var(--bg-3)] text-[color:var(--fg-1)]'
                      : 'hover:bg-[color:var(--bg-2)] text-[color:var(--fg-2)]',
                  ].join(' ')}
                  onClick={() => selectItem(currentIndex)}
                  onMouseEnter={() => setSelectedIndex(currentIndex)}
                >
                  <div className="w-6 h-6 flex items-center justify-center rounded-md bg-[color:var(--bg-3)] text-[color:var(--fg-2)] shrink-0">
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-[color:var(--fg-4)] ml-auto">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    );
  },
);

SlashCommandList.displayName = 'SlashCommandList';
