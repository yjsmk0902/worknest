import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

/**
 * Notion-style block drag handle.
 *
 * Uses pointer events (mousedown / mousemove / mouseup) rather than HTML5
 * drag-drop. HTML5 drag events interact with the browser's built-in drag
 * system and with ProseMirror's own drag handlers in subtle ways that made
 * some blocks (everything except atom nodes) undraggable. A pointer-based
 * implementation gives us full control and works consistently for any
 * block type.
 */

const PLUGIN_KEY = new PluginKey('dragHandle');
const HANDLE_WIDTH = 20;
const HANDLE_GAP = 6;
const LEFT_HIT_TOLERANCE = HANDLE_WIDTH + HANDLE_GAP + 6;
const DRAG_THRESHOLD_PX = 4;

function createHandle() {
  const el = document.createElement('div');
  el.className = 'editor-drag-handle';
  el.contentEditable = 'false';
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

function createGhost(source: HTMLElement) {
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.style.position = 'fixed';
  ghost.style.pointerEvents = 'none';
  ghost.style.opacity = '0.7';
  ghost.style.zIndex = '9997';
  ghost.style.width = `${source.getBoundingClientRect().width}px`;
  ghost.style.background = 'var(--bg-2)';
  ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
  ghost.style.borderRadius = '6px';
  ghost.style.padding = '4px 8px';
  return ghost;
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

      // Pointer-drag state
      let dragState: {
        startX: number;
        startY: number;
        sourcePos: number;
        sourceDom: HTMLElement;
        ghost: HTMLElement | null;
        started: boolean;
        targetPos: number | null;
      } | null = null;

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

      const onDocumentMouseMove = (e: MouseEvent) => {
        // While actively dragging a block, only update drop indicator.
        if (dragState) return;

        if (!view.editable) return;
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

      const updateDropIndicator = (clientY: number) => {
        if (!dragState) return;
        const hit = findBlockAtY(view, clientY);
        if (!hit) {
          hideDropLine();
          dragState.targetPos = null;
          return;
        }

        const rect = hit.dom.getBoundingClientRect();
        const midY = (rect.top + rect.bottom) / 2;
        const insertBefore = clientY < midY;
        const node = view.state.doc.nodeAt(hit.pos);
        const nodeSize = node?.nodeSize ?? 0;
        const insertPos = insertBefore ? hit.pos : hit.pos + nodeSize;

        const sourceSize =
          view.state.doc.nodeAt(dragState.sourcePos)?.nodeSize ?? 0;
        if (
          insertPos === dragState.sourcePos ||
          insertPos === dragState.sourcePos + sourceSize
        ) {
          hideDropLine();
          dragState.targetPos = null;
          return;
        }

        dragState.targetPos = insertPos;
        showDropLine(rect, insertBefore);
      };

      const onDragMouseMove = (e: MouseEvent) => {
        if (!dragState) return;
        e.preventDefault();

        const dx = e.clientX - dragState.startX;
        const dy = e.clientY - dragState.startY;

        // Start the drag only after the pointer moves past a small
        // threshold to distinguish from plain clicks.
        if (!dragState.started) {
          if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
          dragState.started = true;
          dragState.ghost = createGhost(dragState.sourceDom);
          document.body.appendChild(dragState.ghost);
          hide();
          document.body.style.cursor = 'grabbing';
        }

        if (dragState.ghost) {
          dragState.ghost.style.top = `${e.clientY + 8}px`;
          dragState.ghost.style.left = `${e.clientX + 8}px`;
        }

        updateDropIndicator(e.clientY);
      };

      const finishDrag = () => {
        if (!dragState) return;
        const state = dragState;
        dragState = null;
        hideDropLine();
        if (state.ghost) state.ghost.remove();
        document.body.style.cursor = '';

        document.removeEventListener('mousemove', onDragMouseMove, true);
        document.removeEventListener('mouseup', onDragMouseUp, true);
        document.removeEventListener('keydown', onDragKeyDown, true);

        if (!state.started || state.targetPos === null) return;

        const { state: editorState } = view;
        const sourceNode = editorState.doc.nodeAt(state.sourcePos);
        if (!sourceNode) return;

        const sourceSize = sourceNode.nodeSize;
        if (
          state.targetPos > state.sourcePos &&
          state.targetPos < state.sourcePos + sourceSize
        ) {
          return;
        }

        const tr = editorState.tr;
        tr.delete(state.sourcePos, state.sourcePos + sourceSize);
        const adjustedTarget =
          state.targetPos > state.sourcePos
            ? state.targetPos - sourceSize
            : state.targetPos;
        tr.insert(adjustedTarget, sourceNode);
        view.dispatch(tr);
      };

      const onDragMouseUp = (e: MouseEvent) => {
        e.preventDefault();
        finishDrag();
      };

      const onDragKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && dragState) {
          // Cancel drag
          dragState.targetPos = null;
          finishDrag();
        }
      };

      const onHandleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return;
        if (hoveredPos === null || !currentBlockDom) return;

        e.preventDefault();
        dragState = {
          startX: e.clientX,
          startY: e.clientY,
          sourcePos: hoveredPos,
          sourceDom: currentBlockDom,
          ghost: null,
          started: false,
          targetPos: null,
        };

        // Select the block so subsequent click-only behavior still works.
        try {
          const selection = NodeSelection.create(view.state.doc, hoveredPos);
          view.dispatch(view.state.tr.setSelection(selection));
        } catch {
          // Some atom boundaries can reject NodeSelection — ignore.
        }

        document.addEventListener('mousemove', onDragMouseMove, true);
        document.addEventListener('mouseup', onDragMouseUp, true);
        document.addEventListener('keydown', onDragKeyDown, true);
      };

      handle.addEventListener('mousedown', onHandleMouseDown);
      document.addEventListener('mousemove', onDocumentMouseMove);
      window.addEventListener('scroll', () => {
        if (currentBlockDom && hoveredPos !== null) {
          showAtBlock(hoveredPos, currentBlockDom);
        }
      }, true);

      return {
        destroy() {
          if (hideTimeout) clearTimeout(hideTimeout);
          if (dragState?.ghost) dragState.ghost.remove();
          handle.removeEventListener('mousedown', onHandleMouseDown);
          document.removeEventListener('mousemove', onDocumentMouseMove);
          document.removeEventListener('mousemove', onDragMouseMove, true);
          document.removeEventListener('mouseup', onDragMouseUp, true);
          document.removeEventListener('keydown', onDragKeyDown, true);
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
