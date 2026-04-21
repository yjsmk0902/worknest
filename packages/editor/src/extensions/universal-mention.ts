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
      const kind = node.attrs.kind as UniversalMentionKind;
      const label = node.attrs.label || node.attrs.id;
      const icon = node.attrs.icon as string | null;

      // Distinct visual treatment per kind
      const config = {
        user: {
          marker: '@',
          colorClass:
            'bg-[color:var(--accent-soft)] text-[color:var(--accent-bg)] hover:bg-[color:var(--accent-soft-border)]',
        },
        page: {
          marker: '',
          colorClass:
            'bg-blue-500/12 text-blue-300 hover:bg-blue-500/20',
        },
        issue: {
          marker: '#',
          colorClass:
            'bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20',
        },
      } as const;
      const { marker, colorClass } = config[kind];

      const children: (string | [string, Record<string, unknown>, ...unknown[]])[] = [];
      if (icon && kind === 'page') {
        children.push(['span', { class: 'text-[0.9em]' }, icon]);
      } else if (marker) {
        children.push(['span', { class: 'opacity-70' }, marker]);
      }
      children.push(['span', {}, label]);

      return [
        'a',
        mergeAttributes(HTMLAttributes, {
          'data-type': 'universal-mention',
          'data-kind': kind,
          class: `inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium no-underline transition-colors ${colorClass}`,
        }),
        ...children,
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
