import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageLink: {
      /** Insert a block-level link to an existing wiki page. */
      insertPageLink: (attrs: {
        pageId: string;
        spaceId: string;
        title: string;
        icon?: string | null;
        href: string;
      }) => ReturnType;
    };
  }
}

/**
 * Block-level link to a wiki page.
 *
 * Renders as a Notion-style "link to page" row: icon + title wrapped in an
 * anchor that navigates to the target page. Distinct from the universal
 * `@page` mention (which is inline) — this one is block-level so a reader
 * scanning the page sees it as a prominent entry point.
 */
export const PageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-page-id') ?? '',
        renderHTML: (attrs) => ({ 'data-page-id': attrs.pageId }),
      },
      spaceId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-space-id') ?? '',
        renderHTML: (attrs) => ({ 'data-space-id': attrs.spaceId }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') ?? '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title }),
      },
      icon: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-icon') ?? null,
        renderHTML: (attrs) => (attrs.icon ? { 'data-icon': attrs.icon } : {}),
      },
      href: {
        default: '',
        parseHTML: (el) => el.getAttribute('href') ?? '',
        renderHTML: (attrs) => ({ href: attrs.href || '#' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="page-link"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const title = (node.attrs.title as string) || '제목 없음';
    const icon = node.attrs.icon as string | null;

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'page-link',
        class: 'page-link-card',
      }),
      ['span', { class: 'page-link-icon' }, icon ?? '📄'],
      ['span', { class: 'page-link-title' }, title],
    ];
  },

  addCommands() {
    return {
      insertPageLink:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                pageId: attrs.pageId,
                spaceId: attrs.spaceId,
                title: attrs.title,
                icon: attrs.icon ?? null,
                href: attrs.href,
              },
            })
            .run(),
    };
  },
});
