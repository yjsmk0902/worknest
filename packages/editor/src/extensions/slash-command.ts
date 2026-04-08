import { Extension, type Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions, type Range } from "@tiptap/suggestion";
import {
  SlashCommandList,
  getSlashCommandItems,
  type SlashCommandItem,
  type SlashCommandListRef,
} from "./slash-command-list";

/**
 * Creates a floating container positioned relative to the cursor.
 * Same pattern as the mention extension.
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
 * TipTap extension for slash commands (`/`).
 *
 * Triggered by typing `/` at the start of an empty paragraph.
 * Shows a floating menu with block types organized by category.
 * Supports search filtering and keyboard navigation.
 */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        items: ({ query }: { query: string }) => {
          const allItems = getSlashCommandItems();
          if (!query) return allItems;

          const lowerQuery = query.toLowerCase();
          return allItems.filter(
            (item) =>
              item.title.toLowerCase().includes(lowerQuery) ||
              item.keywords.some((kw) => kw.includes(lowerQuery)) ||
              item.description.toLowerCase().includes(lowerQuery),
          );
        },
        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let container: HTMLElement | null = null;

          return {
            onStart: (props: Record<string, unknown>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  ...props,
                  command: (item: SlashCommandItem) => {
                    (props.command as (item: SlashCommandItem) => void)(item);
                  },
                },
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
              component?.updateProps({
                ...props,
                command: (item: SlashCommandItem) => {
                  (props.command as (item: SlashCommandItem) => void)(item);
                },
              });

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
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          props.command({ editor, range });
        },
      } as Partial<SuggestionOptions<SlashCommandItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
