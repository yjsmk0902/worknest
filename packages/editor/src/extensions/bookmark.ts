import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

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

  addProseMirrorPlugins() {
    return [createBookmarkPastePlugin()];
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

const bookmarkPastePluginKey = new PluginKey('bookmarkPaste');

/**
 * Detect bare-URL pastes on an empty block and convert them to a bookmark
 * card. Paste into non-empty text (e.g. mid-sentence) is left alone so the
 * user still gets a plain link. Metadata is fetched asynchronously and the
 * inserted card is upgraded via `setNodeMarkup` once it arrives.
 */
function createBookmarkPastePlugin(): Plugin {
  return new Plugin({
    key: bookmarkPastePluginKey,
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain')?.trim();
        if (!text) return false;

        let url: URL;
        try {
          url = new URL(text);
        } catch {
          return false;
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        if (/\s/.test(text)) return false;

        const { state } = view;
        const { $from, empty } = state.selection;
        if (!empty) return false;

        const parent = $from.parent;
        if (parent.type.name !== 'paragraph') return false;
        if (parent.content.size !== 0) return false;

        // Skip when the caret is inside a table cell — turning the cell's
        // paragraph into a block-level bookmark card breaks the cell layout.
        for (let d = $from.depth; d >= 0; d -= 1) {
          const name = $from.node(d).type.name;
          if (name === 'tableCell' || name === 'tableHeader') return false;
        }

        const bookmarkType = state.schema.nodes.bookmark;
        if (!bookmarkType) return false;

        const urlString = url.toString();
        const bookmarkNode = bookmarkType.create({
          url: urlString,
          title: null,
          description: null,
          image: null,
          favicon: null,
          siteName: null,
        });

        const tr = state.tr.replaceSelectionWith(bookmarkNode);
        view.dispatch(tr);

        event.preventDefault();

        fetchBookmarkMetadata(view, urlString);
        return true;
      },
    },
  });
}

function fetchBookmarkMetadata(
  view: Parameters<NonNullable<Plugin['props']['handlePaste']>>[0],
  url: string,
): void {
  fetch(`/api/v1/url-preview?url=${encodeURIComponent(url)}`, {
    credentials: 'include',
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((preview) => {
      if (!preview || typeof preview !== 'object') return;
      const { state } = view;
      let targetPos: number | null = null;
      state.doc.descendants((node, pos) => {
        if (
          node.type.name === 'bookmark' &&
          node.attrs.url === url &&
          !node.attrs.description &&
          !node.attrs.siteName
        ) {
          targetPos = pos;
        }
        return true;
      });
      if (targetPos === null) return;
      const tr = view.state.tr.setNodeMarkup(targetPos, undefined, {
        url,
        title: preview.title ?? null,
        description: preview.description ?? null,
        image: preview.image ?? null,
        favicon: preview.favicon ?? null,
        siteName: preview.siteName ?? null,
      });
      view.dispatch(tr);
    })
    .catch(() => {
      // Silent — placeholder card keeps the URL as its own label.
    });
}
