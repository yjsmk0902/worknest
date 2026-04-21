import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Notion-style block drag handle.
 *
 * A single floating handle follows the block under the cursor. Clicking it
 * selects the block; dragging it initiates a native drag+drop that PM
 * turns into a block move.
 *
 * The handle is mounted on `document.body` with fixed positioning so it
 * doesn't get affected by React re-renders to the editor wrapper.
 */

const PLUGIN_KEY = new PluginKey('dragHandle');
const HANDLE_WIDTH = 20;
const HANDLE_GAP = 6;
const LEFT_HIT_TOLERANCE = HANDLE_WIDTH + HANDLE_GAP + 6;

function createHandle() {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'editor-drag-handle';
  el.contentEditable = 'false';
  el.draggable = true;
  el.setAttribute('aria-label', '블록 이동');
  el.innerHTML = `
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.4" />
      <circle cx="9" cy="3" r="1.4" />
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="9" cy="8" r="1.4" />
      <circle cx="3" cy="13" r="1.4" />
      <circle cx="9" cy="13" r="1.4" />
    </svg>
  `;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  el.style.transition = 'opacity 120ms ease';
  return el;
}

function findBlockAtY(
  view: EditorView,
  clientY: number,
): { pos: number; dom: HTMLElement } | null {
  const contentRoot = view.dom;

  for (let child = contentRoot.firstElementChild; child; child = child.nextElementSibling) {
    if (!(child instanceof HTMLElement)) continue;
    const rect = child.getBoundingClientRect();
    if (rect.height === 0) continue;
    if (clientY >= rect.top - 2 && clientY <= rect.bottom + 2) {
      try {
        const pos = view.posAtDOM(child, 0);
        return { pos: Math.max(0, pos - 1), dom: child };
      } catch {
        // fall through
      }
    }
  }
  return null;
}

function dragHandlePlugin() {
  return new Plugin({
    key: PLUGIN_KEY,
    view(view) {
      const handle = createHandle();
      document.body.appendChild(handle);

      let hoveredPos: number | null = null;
      let currentBlockDom: HTMLElement | null = null;
      let hideTimeout: ReturnType<typeof setTimeout> | null = null;

      const showAtBlock = (pos: number, dom: HTMLElement) => {
        const rect = dom.getBoundingClientRect();
        // Fixed positioning — use clientX/Y coordinates directly.
        handle.style.top = `${rect.top + 4}px`;
        handle.style.left = `${rect.left - (HANDLE_WIDTH + HANDLE_GAP)}px`;
        handle.style.opacity = '1';
        handle.style.pointerEvents = 'auto';
        hoveredPos = pos;
        currentBlockDom = dom;
      };

      const hide = () => {
        handle.style.opacity = '0';
        handle.style.pointerEvents = 'none';
        hoveredPos = null;
        currentBlockDom = null;
      };

      const scheduleHide = () => {
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(hide, 120);
      };

      const cancelHide = () => {
        if (hideTimeout) {
          clearTimeout(hideTimeout);
          hideTimeout = null;
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!view.editable) return;

        // Pointer over the handle → keep visible.
        if (handle.contains(e.target as Node)) {
          cancelHide();
          return;
        }

        const contentRect = view.dom.getBoundingClientRect();
        const insideHorizontally =
          e.clientX >= contentRect.left - LEFT_HIT_TOLERANCE &&
          e.clientX <= contentRect.right;
        const insideVertically =
          e.clientY >= contentRect.top - 4 && e.clientY <= contentRect.bottom + 4;

        if (!insideHorizontally || !insideVertically) {
          scheduleHide();
          return;
        }

        const block = findBlockAtY(view, e.clientY);
        if (!block) {
          scheduleHide();
          return;
        }
        cancelHide();
        if (block.pos !== hoveredPos) {
          showAtBlock(block.pos, block.dom);
        }
      };

      const onHandleClick = (e: MouseEvent) => {
        if (hoveredPos === null) return;
        e.preventDefault();
        const tr = view.state.tr.setSelection(
          NodeSelection.create(view.state.doc, hoveredPos),
        );
        view.dispatch(tr);
        view.focus();
      };

      const onHandleDragStart = (e: DragEvent) => {
        if (hoveredPos === null) return;
        const tr = view.state.tr.setSelection(
          NodeSelection.create(view.state.doc, hoveredPos),
        );
        view.dispatch(tr);
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          const slice = view.state.selection.content();
          const serialized =
            view.someProp('clipboardSerializer')?.serializeFragment(slice.content) ??
            null;
          if (serialized) {
            const div = document.createElement('div');
            div.appendChild(serialized as Node);
            e.dataTransfer.setData('text/html', div.innerHTML);
            e.dataTransfer.setData('text/plain', div.innerText);
          }
          if (currentBlockDom) {
            e.dataTransfer.setDragImage(currentBlockDom, 0, 0);
          }
        }
      };

      const onScroll = () => {
        if (currentBlockDom) {
          showAtBlock(hoveredPos!, currentBlockDom);
        }
      };

      handle.addEventListener('click', onHandleClick);
      handle.addEventListener('dragstart', onHandleDragStart);
      document.addEventListener('mousemove', onMouseMove);
      window.addEventListener('scroll', onScroll, true);

      return {
        destroy() {
          if (hideTimeout) clearTimeout(hideTimeout);
          handle.removeEventListener('click', onHandleClick);
          handle.removeEventListener('dragstart', onHandleDragStart);
          document.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('scroll', onScroll, true);
          handle.remove();
        },
      };
    },
  });
}

export const DragHandle = Extension.create({
  name: 'dragHandle',
  addProseMirrorPlugins() {
    return [dragHandlePlugin()];
  },
});
