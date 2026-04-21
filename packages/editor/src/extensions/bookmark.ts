import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      insertBookmark: (attrs: {
        url: string;
        title?: string | null;
        description?: string | null;
        image?: string | null;
        favicon?: string | null;
        siteName?: string | null;
      }) => ReturnType;
    };
  }
}

/**
 * Bookmark (link preview) block — a rich card for an external URL.
 *
 * Renders a Notion-style card:
 *  [ thumbnail ]  title
 *                 description
 *                 favicon  site name
 *
 * Stored entirely in the document JSON; the consumer fetches OG metadata
 * via `/api/v1/url-preview?url=...` when inserting.
 */
export const Bookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') ?? '',
        renderHTML: (attrs) => ({ 'data-url': attrs.url }),
      },
      title: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-title') ?? null,
        renderHTML: (attrs) => (attrs.title ? { 'data-title': attrs.title } : {}),
      },
      description: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-description') ?? null,
        renderHTML: (attrs) =>
          attrs.description ? { 'data-description': attrs.description } : {},
      },
      image: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-image') ?? null,
        renderHTML: (attrs) => (attrs.image ? { 'data-image': attrs.image } : {}),
      },
      favicon: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-favicon') ?? null,
        renderHTML: (attrs) => (attrs.favicon ? { 'data-favicon': attrs.favicon } : {}),
      },
      siteName: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute('data-site-name') ?? null,
        renderHTML: (attrs) =>
          attrs.siteName ? { 'data-site-name': attrs.siteName } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="bookmark"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const {
      url,
      title,
      description,
      image,
      favicon,
      siteName,
    } = node.attrs as {
      url: string;
      title: string | null;
      description: string | null;
      image: string | null;
      favicon: string | null;
      siteName: string | null;
    };

    const hostname = (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    })();

    const textChildren: (
      | string
      | [string, Record<string, unknown>, ...unknown[]]
    )[] = [
      ['div', { class: 'bookmark-title' }, title ?? url],
    ];
    if (description) {
      textChildren.push(['div', { class: 'bookmark-description' }, description]);
    }
    const footer: (
      | string
      | [string, Record<string, unknown>, ...unknown[]]
    )[] = [];
    if (favicon) {
      footer.push([
        'img',
        { class: 'bookmark-favicon', src: favicon, alt: '' },
      ]);
    }
    footer.push(['span', { class: 'bookmark-host' }, siteName ?? hostname]);
    textChildren.push(['div', { class: 'bookmark-meta' }, ...footer]);

    const children: (
      | string
      | [string, Record<string, unknown>, ...unknown[]]
    )[] = [['div', { class: 'bookmark-text' }, ...textChildren]];

    if (image) {
      children.push([
        'div',
        { class: 'bookmark-image' },
        ['img', { src: image, alt: '' }],
      ]);
    }

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'bookmark',
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'bookmark-card',
      }),
      ...children,
    ];
  },

  addCommands() {
    return {
      insertBookmark:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                url: attrs.url,
                title: attrs.title ?? null,
                description: attrs.description ?? null,
                image: attrs.image ?? null,
                favicon: attrs.favicon ?? null,
                siteName: attrs.siteName ?? null,
              },
            })
            .run(),
    };
  },
});
