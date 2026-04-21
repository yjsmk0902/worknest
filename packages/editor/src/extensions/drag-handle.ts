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
 * The handle lives in the editor wrapper (the ProseMirror contenteditable's
 * parent) so we can detect hover over both the content AND the gutter where
 * the handle sits. Mouse listeners target that wrapper, not the content
 * element — otherwise moving the pointer toward the handle triggers
 * mouseleave on the content and hides the handle before the user can grab.
 */

const PLUGIN_KEY = new PluginKey('dragHandle');
const HANDLE_WIDTH = 20;
const HANDLE_GAP = 6;
// Extend the hit region to the left of the content so the handle stays
// visible while the pointer travels over to it.
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
  el.style.position = 'absolute';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '30';
  el.style.transition = 'opacity 120ms ease';
  return el;
}

/**
 * Find the top-level block whose DOM occupies the given clientY. We do not
 * rely on `posAtCoords` because empty paragraphs and some atom nodes
 * (bookmark, horizontalRule) don't resolve there.
 */
function findBlockAtY(
  view: EditorView,
  clientY: number,
): { pos: number; dom: HTMLElement } | null {
  const contentRoot = view.dom;
  let best: { pos: number; dom: HTMLElement; dist: number } | null = null;

  // Iterate direct children of the contenteditable root (top-level blocks).
  for (let child = contentRoot.firstElementChild; child; child = child.nextElementSibling) {
    if (!(child instanceof HTMLElement)) continue;
    const rect = child.getBoundingClientRect();
    if (rect.height === 0) continue;
    if (clientY >= rect.top && clientY <= rect.bottom) {
      try {
        const pos = view.posAtDOM(child, 0);
        return { pos: Math.max(0, pos - 1), dom: child };
      } catch {
        // fall through
      }
    }
    // Track nearest block for small tolerance when cursor sits between
    // blocks (very small gaps)
    const center = (rect.top + rect.bottom) / 2;
    const dist = Math.abs(clientY - center);
    if (!best || dist < best.dist) {
      try {
        const pos = view.posAtDOM(child, 0);
        best = { pos: Math.max(0, pos - 1), dom: child, dist };
      } catch {
        // ignore
      }
    }
  }

  if (best && best.dist < 12) return { pos: best.pos, dom: best.dom };
  return null;
}

function dragHandlePlugin() {
  return new Plugin({
    key: PLUGIN_KEY,
    view(view) {
      const wrapper = view.dom.parentElement;
      if (!wrapper) return { destroy() {} };

      if (getComputedStyle(wrapper).position === 'static') {
        wrapper.style.position = 'relative';
      }

      const handle = createHandle();
      wrapper.appendChild(handle);

      let hoveredPos: number | null = null;
      let currentBlockDom: HTMLElement | null = null;

      const showAtBlock = (pos: number, dom: HTMLElement) => {
        const wrapperRect = wrapper.getBoundingClientRect();
        const rect = dom.getBoundingClientRect();
        const top = rect.top - wrapperRect.top + 4;
        const left = rect.left - wrapperRect.left - (HANDLE_WIDTH + HANDLE_GAP);
        handle.style.top = `${top}px`;
        handle.style.left = `${left}px`;
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

      const onMouseMove = (e: MouseEvent) => {
        if (!view.editable) return;

        // Keep showing while hovering the handle itself.
        if (handle.contains(e.target as Node)) return;

        const contentRect = view.dom.getBoundingClientRect();
        // Broaden the hit zone to the LEFT so we cover the handle gutter.
        const insideHorizontally =
          e.clientX >= contentRect.left - LEFT_HIT_TOLERANCE &&
          e.clientX <= contentRect.right;
        if (!insideHorizontally) {
          hide();
          return;
        }

        const block = findBlockAtY(view, e.clientY);
        if (!block) {
          hide();
          return;
        }
        if (block.pos !== hoveredPos) {
          showAtBlock(block.pos, block.dom);
        }
      };

      const onMouseLeave = (e: MouseEvent) => {
        // Only hide when the pointer actually leaves the wrapper — moving
        // from content to handle (both children of wrapper) must not hide.
        const related = e.relatedTarget as Node | null;
        if (related && wrapper.contains(related)) return;
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

      handle.addEventListener('click', onHandleClick);
      handle.addEventListener('dragstart', onHandleDragStart);
      wrapper.addEventListener('mousemove', onMouseMove);
      wrapper.addEventListener('mouseleave', onMouseLeave);

      return {
        destroy() {
          handle.removeEventListener('click', onHandleClick);
          handle.removeEventListener('dragstart', onHandleDragStart);
          wrapper.removeEventListener('mousemove', onMouseMove);
          wrapper.removeEventListener('mouseleave', onMouseLeave);
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
