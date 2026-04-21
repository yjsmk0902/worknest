import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Notion-style block drag handle.
 *
 * Renders a single floating handle element next to the block currently under
 * the mouse. Dragging the handle creates a node-selection drag, and
 * ProseMirror's built-in drop handling takes care of reordering.
 *
 * The handle also acts as a selection affordance: clicking selects the
 * whole block (NodeSelection), so Backspace / arrow keys operate on the
 * block level.
 */

const PLUGIN_KEY = new PluginKey('dragHandle');

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
  el.style.position = 'absolute';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '30';
  el.style.transition = 'opacity 120ms ease';
  return el;
}

function findTopLevelBlockPos(view: EditorView, clientX: number, clientY: number) {
  const posInfo = view.posAtCoords({ left: clientX, top: clientY });
  if (!posInfo) return null;

  // Walk up from the resolved position to the direct child of the document
  const $pos = view.state.doc.resolve(posInfo.inside >= 0 ? posInfo.inside : posInfo.pos);
  if ($pos.depth < 1) return null;
  return $pos.before(1);
}

function dragHandlePlugin() {
  let handle: HTMLButtonElement | null = null;
  let hoveredPos: number | null = null;
  let currentBlockDom: HTMLElement | null = null;

  return new Plugin({
    key: PLUGIN_KEY,
    view(view) {
      handle = createHandle();

      // Keep position:relative on the editor wrapper so the handle can be
      // absolutely positioned within it.
      const parent = view.dom.parentElement;
      if (parent) {
        const currentPosition = getComputedStyle(parent).position;
        if (currentPosition === 'static') {
          parent.style.position = 'relative';
        }
        parent.appendChild(handle);
      }

      const showAtBlock = (blockStartPos: number) => {
        if (!handle || !view.dom.parentElement) return;
        const dom = view.nodeDOM(blockStartPos) as HTMLElement | null;
        if (!dom || !(dom instanceof HTMLElement)) return;
        currentBlockDom = dom;
        const parentRect = view.dom.parentElement.getBoundingClientRect();
        const rect = dom.getBoundingClientRect();
        // Place the handle to the left of the block, vertically centred on
        // the first line (approx 10px from top of block).
        const top = rect.top - parentRect.top + 6;
        const left = rect.left - parentRect.left - 24;
        handle.style.top = `${top}px`;
        handle.style.left = `${left}px`;
        handle.style.opacity = '1';
        handle.style.pointerEvents = 'auto';
        hoveredPos = blockStartPos;
      };

      const hide = () => {
        if (!handle) return;
        handle.style.opacity = '0';
        handle.style.pointerEvents = 'none';
        hoveredPos = null;
        currentBlockDom = null;
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!view.editable) return;
        // When the cursor moves inside the handle itself, keep it visible.
        if (handle && handle.contains(e.target as Node)) return;
        const pos = findTopLevelBlockPos(view, e.clientX, e.clientY);
        if (pos === null) {
          hide();
          return;
        }
        if (pos !== hoveredPos) showAtBlock(pos);
      };

      const onMouseLeave = (e: MouseEvent) => {
        // Don't hide while pointer is on the handle.
        if (handle && e.relatedTarget instanceof Node && handle.contains(e.relatedTarget)) return;
        hide();
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
        // Let PM's serializer populate the drag data from the selection.
        // We just need to set some data to trigger the drag.
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
          // Visual feedback: drag the block's DOM as the image
          if (currentBlockDom) {
            e.dataTransfer.setDragImage(currentBlockDom, 0, 0);
          }
        }
      };

      handle.addEventListener('click', onHandleClick);
      handle.addEventListener('dragstart', onHandleDragStart);
      view.dom.addEventListener('mousemove', onMouseMove);
      view.dom.addEventListener('mouseleave', onMouseLeave);

      return {
        destroy() {
          handle?.removeEventListener('click', onHandleClick);
          handle?.removeEventListener('dragstart', onHandleDragStart);
          view.dom.removeEventListener('mousemove', onMouseMove);
          view.dom.removeEventListener('mouseleave', onMouseLeave);
          handle?.remove();
          handle = null;
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
