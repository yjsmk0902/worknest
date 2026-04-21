import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { icon?: string; color?: CalloutColor }) => ReturnType;
      toggleCallout: (attrs?: { icon?: string; color?: CalloutColor }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export type CalloutColor = 'default' | 'info' | 'warn' | 'success' | 'danger';

const COLOR_CLASS: Record<CalloutColor, string> = {
  default:
    'bg-[color:var(--bg-2)] border-[color:var(--border-subtle)] text-[color:var(--fg-1)]',
  info: 'bg-blue-500/10 border-blue-500/20 text-[color:var(--fg-1)]',
  warn: 'bg-amber-500/10 border-amber-500/20 text-[color:var(--fg-1)]',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-[color:var(--fg-1)]',
  danger: 'bg-rose-500/10 border-rose-500/20 text-[color:var(--fg-1)]',
};

/**
 * Callout block: inline emoji + colored background, contains block content.
 *
 * Example JSON:
 * { type: 'callout', attrs: { icon: '💡', color: 'info' },
 *   content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
 */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      icon: {
        default: '💡',
        parseHTML: (el) => el.getAttribute('data-icon') ?? '💡',
        renderHTML: (attrs) => ({ 'data-icon': attrs.icon }),
      },
      color: {
        default: 'default' as CalloutColor,
        parseHTML: (el) => (el.getAttribute('data-color') as CalloutColor) ?? 'default',
        renderHTML: (attrs) => ({ 'data-color': attrs.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const color = (node.attrs.color as CalloutColor) ?? 'default';
    const icon = node.attrs.icon ?? '💡';
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: `my-3 flex gap-3 rounded-md border px-3 py-2 ${COLOR_CLASS[color]}`,
      }),
      [
        'div',
        {
          contenteditable: 'false',
          class: 'select-none pt-0.5 text-[18px] leading-none',
        },
        icon,
      ],
      ['div', { class: 'flex-1 min-w-0 [&>*]:my-0' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    };
  },
});
