import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import {
  MentionList,
  type MentionListRef,
  type MentionUser,
} from "./mention-list";

export type { MentionUser } from "./mention-list";

/**
 * Query function type for fetching mention suggestions.
 * The consuming application provides this to search users.
 */
export type MentionQueryFn = (query: string) => Promise<MentionUser[]>;

/**
 * Creates a floating container positioned relative to the cursor.
 * Uses a plain DOM element instead of tippy.js for zero extra dependencies.
 */
function createFloatingContainer() {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.zIndex = "50";
  container.style.pointerEvents = "auto";
  document.body.appendChild(container);
  return container;
}

function updateFloatingPosition(
  container: HTMLElement,
  clientRect: (() => DOMRect) | null,
) {
  if (!clientRect) return;
  const rect = clientRect();
  container.style.left = `${rect.left + window.scrollX}px`;
  container.style.top = `${rect.bottom + window.scrollY + 4}px`;
}

/**
 * Creates a configured TipTap Mention extension.
 *
 * @param queryFn - Async function that searches users by query string.
 *   This should be provided by the consuming application (e.g., API call).
 *
 * @example
 * ```ts
 * const mention = createMentionExtension(async (query) => {
 *   const res = await api.searchUsers(query);
 *   return res.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatar }));
 * });
 * ```
 */
export function createMentionExtension(queryFn: MentionQueryFn) {
  return Mention.configure({
    HTMLAttributes: {
      class:
        "bg-primary/10 text-primary rounded px-1 py-0.5 font-medium cursor-pointer",
    },
    suggestion: {
      items: async ({ query }: { query: string }) => {
        return queryFn(query);
      },
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let container: HTMLElement | null = null;

        return {
          onStart: (props: Record<string, unknown>) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor as Parameters<
                typeof ReactRenderer
              >[1]["editor"],
            });

            container = createFloatingContainer();
            container.appendChild(component.element);

            updateFloatingPosition(
              container,
              props.clientRect as (() => DOMRect) | null,
            );
          },

          onUpdate: (props: Record<string, unknown>) => {
            component?.updateProps(props);

            if (container) {
              updateFloatingPosition(
                container,
                props.clientRect as (() => DOMRect) | null,
              );
            }
          },

          onKeyDown: (props: { event: KeyboardEvent }) => {
            if (props.event.key === "Escape") {
              container?.remove();
              container = null;
              return true;
            }

            return (
              component?.ref?.onKeyDown(
                props as { event: React.KeyboardEvent },
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
    },
  });
}
