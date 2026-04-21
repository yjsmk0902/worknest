import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import { PageMentionList, type PageMentionItem, type PageMentionListRef } from './page-mention-list';

export type { PageMentionItem } from './page-mention-list';

export type PageMentionQueryFn = (query: string) => Promise<PageMentionItem[]>;

function createFloatingContainer() {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.zIndex = '50';
  container.style.pointerEvents = 'auto';
  container.setAttribute('data-suggestion-popup', '');
  document.body.appendChild(container);
  return container;
}

function updateFloatingPosition(container: HTMLElement, clientRect: (() => DOMRect) | null) {
  if (!clientRect) return;
  const rect = clientRect();
  container.style.left = `${rect.left + window.scrollX}px`;
  container.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

/**
 * Factory for a "page mention" extension triggered by `[[`.
 *
 * Inserts an inline page reference node. The consuming app provides:
 *  - `queryFn` to search pages by query string
 *  - `resolveHref(spaceId, pageId)` to build the link target
 *
 * The node's `id` attribute holds the pageId and `label` holds the title.
 * We store `spaceId` as an extra attr so we can build the link on render.
 */
export function createPageMentionExtension(opts: {
  queryFn: PageMentionQueryFn;
  resolveHref: (spaceId: string, pageId: string) => string;
}) {
  return Mention.extend({
    name: 'pageMention',
    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-id'),
          renderHTML: (attrs) => ({ 'data-id': attrs.id }),
        },
        label: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-label'),
          renderHTML: (attrs) => ({ 'data-label': attrs.label }),
        },
        spaceId: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-space-id'),
          renderHTML: (attrs) => ({ 'data-space-id': attrs.spaceId }),
        },
        icon: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-icon'),
          renderHTML: (attrs) => (attrs.icon ? { 'data-icon': attrs.icon } : {}),
        },
      };
    },
    renderHTML({ node }) {
      const href =
        node.attrs.spaceId && node.attrs.id ? opts.resolveHref(node.attrs.spaceId, node.attrs.id) : '#';
      const icon = node.attrs.icon;
      const label = node.attrs.label ?? '제목 없음';
      return [
        'a',
        {
          href,
          'data-type': 'page-mention',
          'data-id': node.attrs.id ?? '',
          'data-space-id': node.attrs.spaceId ?? '',
          class:
            'inline-flex items-center gap-1 bg-[color:var(--bg-2)] hover:bg-[color:var(--bg-3)] rounded px-1 py-0.5 text-[color:var(--fg-1)] font-medium no-underline',
        },
        ...(icon ? [['span', { class: 'text-[0.9em]' }, icon]] : []),
        ['span', {}, label],
      ];
    },
  }).configure({
    suggestion: {
      char: '[[',
      items: async ({ query }: { query: string }) => opts.queryFn(query),
      render: () => {
        let component: ReactRenderer<PageMentionListRef> | null = null;
        let container: HTMLElement | null = null;

        return {
          onStart: (props: Record<string, unknown>) => {
            component = new ReactRenderer(PageMentionList, {
              props,
              editor: props.editor as Parameters<typeof ReactRenderer>[1]['editor'],
            });
            container = createFloatingContainer();
            container.appendChild(component.element);
            updateFloatingPosition(container, props.clientRect as (() => DOMRect) | null);
          },
          onUpdate: (props: Record<string, unknown>) => {
            component?.updateProps(props);
            if (container) {
              updateFloatingPosition(container, props.clientRect as (() => DOMRect) | null);
            }
          },
          onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === 'Escape') {
              container?.remove();
              container = null;
              return true;
            }
            return (
              component?.ref?.onKeyDown(props as unknown as { event: React.KeyboardEvent }) ?? false
            );
          },
          onExit: () => {
            container?.remove();
            container = null;
            component?.destroy();
          },
        };
      },
    },
  });
}
