import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Notion-style block drag handle.
 *
 * The handle itself lives on `document.body` (fixed positioning), so React
 * re-renders of the editor wrapper don't affect it. Because the native
 * dragstart fires OUTSIDE view.dom, we don't rely on PM's built-in move
 * logic — instead we:
 *
 *  1. Remember the source block position at dragstart.
 *  2. On `dragover` inside view.dom, compute the insert point and draw a
 *     thin drop indicator line.
 *  3. On `drop`, build a single transaction that deletes the source node
 *     and inserts it at the target position, then dispatch it.
 */

const PLUGIN_KEY = new PluginKey('dragHandle');
const HANDLE_WIDTH = 20;
const HANDLE_GAP = 6;
const LEFT_HIT_TOLERANCE = HANDLE_WIDTH + HANDLE_GAP + 6;

function createHandle() {
  const el = document.createElement('div');
  el.className = 'editor-drag-handle';
  el.contentEditable = 'false';
  el.draggable = true;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
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

function createDropLine() {
  const el = document.createElement('div');
  el.className = 'editor-drop-indicator';
  el.style.position = 'fixed';
  el.style.height = '2px';
  el.style.background = 'var(--accent-bg)';
  el.style.borderRadius = '1px';
  el.style.pointerEvents = 'none';
  el.style.opacity = '0';
  el.style.zIndex = '9998';
  el.style.transition = 'opacity 80ms ease';
  return el;
}

interface BlockHit {
  pos: number;
  dom: HTMLElement;
}

function findBlockAtY(view: EditorView, clientY: number): BlockHit | null {
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
        // skip
      }
    }
  }
  return null;
}

/**
 * Determine where to insert the dragged block relative to a hovered block.
 * Top half of hovered block → insert BEFORE it. Bottom half → insert AFTER.
 */
function computeInsertInfo(hit: BlockHit, clientY: number) {
  const rect = hit.dom.getBoundingClientRect();
  const midY = (rect.top + rect.bottom) / 2;
  const insertBefore = clientY < midY;
  return { insertBefore, rect };
}

function dragHandlePlugin() {
  return new Plugin({
    key: PLUGIN_KEY,
    view(view) {
      const handle = createHandle();
      const dropLine = createDropLine();
      document.body.appendChild(handle);
      document.body.appendChild(dropLine);

      let hoveredPos: number | null = null;
      let currentBlockDom: HTMLElement | null = null;
      let hideTimeout: ReturnType<typeof setTimeout> | null = null;

      // Drag state
      let dragSourcePos: number | null = null;
      let dragTargetPos: number | null = null;

      const showAtBlock = (pos: number, dom: HTMLElement) => {
        const rect = dom.getBoundingClientRect();
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

      const hideDropLine = () => {
        dropLine.style.opacity = '0';
      };

      const showDropLine = (rect: DOMRect, above: boolean) => {
        const y = above ? rect.top : rect.bottom;
        dropLine.style.top = `${y - 1}px`;
        dropLine.style.left = `${rect.left}px`;
        dropLine.style.width = `${rect.width}px`;
        dropLine.style.opacity = '1';
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
        if (dragSourcePos !== null) return; // don't reposition while dragging

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
        if (hoveredPos === null || !e.dataTransfer) return;

        dragSourcePos = hoveredPos;
        const blockDom = currentBlockDom;

        e.dataTransfer.effectAllowed = 'move';
        // A minimal text payload so the browser accepts the drag.
        e.dataTransfer.setData('application/x-worknest-block', String(dragSourcePos));
        if (blockDom) {
          e.dataTransfer.setDragImage(blockDom, 10, 10);
        }

        hide();
      };

      const onHandleDragEnd = () => {
        dragSourcePos = null;
        dragTargetPos = null;
        hideDropLine();
      };

      const onEditorDragOver = (e: DragEvent) => {
        if (dragSourcePos === null) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

        const hit = findBlockAtY(view, e.clientY);
        if (!hit) {
          hideDropLine();
          dragTargetPos = null;
          return;
        }
        // Don't show indicator on top of the source itself
        const { insertBefore, rect } = computeInsertInfo(hit, e.clientY);
        const node = view.state.doc.nodeAt(hit.pos);
        const nodeSize = node?.nodeSize ?? 0;
        const insertPos = insertBefore ? hit.pos : hit.pos + nodeSize;

        // Skip if target equals source (no-op)
        if (insertPos === dragSourcePos || insertPos === dragSourcePos + (view.state.doc.nodeAt(dragSourcePos)?.nodeSize ?? 0)) {
          hideDropLine();
          dragTargetPos = null;
          return;
        }

        dragTargetPos = insertPos;
        showDropLine(rect, insertBefore);
      };

      const onEditorDrop = (e: DragEvent) => {
        if (dragSourcePos === null) return;
        e.preventDefault();

        const sourcePos = dragSourcePos;
        const targetPos = dragTargetPos;
        dragSourcePos = null;
        dragTargetPos = null;
        hideDropLine();

        if (targetPos === null) return;

        const { state } = view;
        const sourceNode = state.doc.nodeAt(sourcePos);
        if (!sourceNode) return;

        const sourceSize = sourceNode.nodeSize;
        // If target is inside the source range, bail
        if (targetPos > sourcePos && targetPos < sourcePos + sourceSize) return;

        const tr = state.tr;
        // Remove the source node first, then insert at the adjusted target
        tr.delete(sourcePos, sourcePos + sourceSize);
        const adjustedTarget =
          targetPos > sourcePos ? targetPos - sourceSize : targetPos;
        tr.insert(adjustedTarget, sourceNode);
        view.dispatch(tr);
      };

      handle.addEventListener('click', onHandleClick);
      handle.addEventListener('dragstart', onHandleDragStart);
      handle.addEventListener('dragend', onHandleDragEnd);
      document.addEventListener('mousemove', onMouseMove);
      view.dom.addEventListener('dragover', onEditorDragOver);
      view.dom.addEventListener('drop', onEditorDrop);

      return {
        destroy() {
          if (hideTimeout) clearTimeout(hideTimeout);
          handle.removeEventListener('click', onHandleClick);
          handle.removeEventListener('dragstart', onHandleDragStart);
          handle.removeEventListener('dragend', onHandleDragEnd);
          document.removeEventListener('mousemove', onMouseMove);
          view.dom.removeEventListener('dragover', onEditorDragOver);
          view.dom.removeEventListener('drop', onEditorDrop);
          handle.remove();
          dropLine.remove();
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
