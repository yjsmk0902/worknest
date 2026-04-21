import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

const UNIVERSAL_MENTION_PLUGIN_KEY = new PluginKey('universalMention');
import {
  UniversalMentionList,
  type UniversalMentionItem,
  type UniversalMentionKind,
  type UniversalMentionListRef,
} from './universal-mention-list';

export type { UniversalMentionItem, UniversalMentionKind } from './universal-mention-list';

export type UniversalMentionQueryFn = (query: string) => Promise<UniversalMentionItem[]>;

export interface UniversalMentionOptions {
  queryFn: UniversalMentionQueryFn;
  resolveHref: (item: UniversalMentionItem) => string;
}

function createFloatingContainer() {
  const c = document.createElement('div');
  c.style.position = 'absolute';
  c.style.zIndex = '50';
  c.style.pointerEvents = 'auto';
  c.setAttribute('data-suggestion-popup', '');
  document.body.appendChild(c);
  return c;
}

function updateFloatingPosition(c: HTMLElement, clientRect: (() => DOMRect) | null) {
  if (!clientRect) return;
  const rect = clientRect();
  c.style.left = `${rect.left + window.scrollX}px`;
  c.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

/**
 * Universal `@` mention — single trigger that searches members, wiki pages,
 * and issues. Inserts a typed mention node that renders as a clickable link.
 */
export function createUniversalMentionExtension(opts: UniversalMentionOptions) {
  return Node.create({
    name: 'universalMention',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        kind: {
          default: 'user',
          parseHTML: (el) => el.getAttribute('data-kind'),
          renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
        },
        id: {
          default: '',
          parseHTML: (el) => el.getAttribute('data-id'),
          renderHTML: (attrs) => ({ 'data-id': attrs.id }),
        },
        label: {
          default: '',
          parseHTML: (el) => el.getAttribute('data-label'),
          renderHTML: (attrs) => ({ 'data-label': attrs.label }),
        },
        href: {
          default: '',
          parseHTML: (el) => el.getAttribute('href'),
          renderHTML: (attrs) => ({ href: attrs.href || '#' }),
        },
        icon: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-icon'),
          renderHTML: (attrs) =>
            attrs.icon ? { 'data-icon': attrs.icon } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: 'a[data-type="universal-mention"]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
      const prefix =
        node.attrs.kind === 'user' ? '@' : node.attrs.kind === 'issue' ? '' : '';
      const label = node.attrs.label || node.attrs.id;
      const display = prefix + label;
      const icon = node.attrs.icon;
      const kind = node.attrs.kind as UniversalMentionKind;
      const colorClass =
        kind === 'user'
          ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent-bg)]'
          : kind === 'page'
            ? 'bg-[color:var(--bg-2)] text-[color:var(--fg-1)] hover:bg-[color:var(--bg-3)]'
            : 'bg-[color:var(--bg-2)] text-[color:var(--fg-1)] hover:bg-[color:var(--bg-3)]';

      return [
        'a',
        mergeAttributes(HTMLAttributes, {
          'data-type': 'universal-mention',
          class: `inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium no-underline ${colorClass}`,
        }),
        ...(icon ? [['span', { class: 'text-[0.9em]' }, icon] as const] : []),
        ['span', {}, display],
      ];
    },

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey: UNIVERSAL_MENTION_PLUGIN_KEY,
          char: '@',
          allowSpaces: false,
          startOfLine: false,
          items: async ({ query }: { query: string }) => {
            return opts.queryFn(query);
          },
          // biome-ignore lint/suspicious/noExplicitAny: TipTap v2 suggestion
          //   typings are too strict to match our runtime shape.
          command: ({ editor, range, props }: any) => {
            const item = props as UniversalMentionItem;
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: 'universalMention',
                  attrs: {
                    kind: item.kind,
                    id: item.id,
                    label: item.label,
                    href: opts.resolveHref(item),
                    icon: item.icon ?? null,
                  },
                },
                { type: 'text', text: ' ' },
              ])
              .run();
          },
          render: () => {
            let component: ReactRenderer<UniversalMentionListRef> | null = null;
            let container: HTMLElement | null = null;

            return {
              // biome-ignore lint/suspicious/noExplicitAny: same as above
              onStart: (props: any) => {
                component = new ReactRenderer(UniversalMentionList, {
                  props,
                  editor: props.editor,
                });
                container = createFloatingContainer();
                container.appendChild(component.element);
                updateFloatingPosition(container, props.clientRect as (() => DOMRect) | null);
              },
              // biome-ignore lint/suspicious/noExplicitAny: same as above
              onUpdate: (props: any) => {
                component?.updateProps(props);
                if (container) {
                  updateFloatingPosition(container, props.clientRect as (() => DOMRect) | null);
                }
              },
              // biome-ignore lint/suspicious/noExplicitAny: same as above
              onKeyDown: (props: any) => {
                if (props.event.key === 'Escape') {
                  container?.remove();
                  container = null;
                  return true;
                }
                return (
                  component?.ref?.onKeyDown(
                    props as unknown as { event: React.KeyboardEvent },
                  ) ?? false
                );
              },
              onExit: () => {
                container?.remove();
                container = null;
                component?.destroy();
              },
            };
          },
        } as unknown as SuggestionOptions<UniversalMentionItem>),
      ];
    },
  });
}
