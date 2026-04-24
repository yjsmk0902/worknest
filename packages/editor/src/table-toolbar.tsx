import type { Editor } from '@tiptap/react';
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns,
  Combine,
  Rows,
  Split,
  Trash2,
} from 'lucide-react';
import { type CSSProperties, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface TableToolbarProps {
  /** TipTap editor instance */
  editor: Editor;
}

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  tone?: 'default' | 'danger';
}

function ToolbarButton({ onClick, disabled, icon, title, tone = 'default' }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      title={title}
      disabled={disabled}
      className={[
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
        'disabled:opacity-40 disabled:pointer-events-none',
        tone === 'danger'
          ? 'text-[color:var(--priority-urgent)] hover:bg-[color:var(--priority-urgent)]/10'
          : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
      ].join(' ')}
    >
      {icon}
    </button>
  );
}

/**
 * Floating toolbar for table operations.
 *
 * Unlike text formatting, the table toolbar anchors to the **whole table**,
 * not the caret. Using TipTap's `BubbleMenu` didn't work here — its
 * internal plugin computes its own reference rect from the selection and
 * ignores `tippyOptions.getReferenceClientRect`, so the toolbar kept
 * covering the first row.
 *
 * Instead we render via a portal with `position: fixed`, recomputing the
 * table DOM rect on every selection / doc / scroll / resize change. When
 * there's no room above the table we flip below.
 */
export function TableToolbar({ editor }: TableToolbarProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [selectionKey, setSelectionKey] = useState(0);

  useEffect(() => {
    const update = () => {
      if (!editor || editor.isDestroyed) return;
      const { state, view } = editor;
      const { selection } = state;
      const $anchor = selection.$anchor;

      // Only show when the caret is in a cell OR a CellSelection spans cells.
      const isCellSelection = (selection.constructor as { name?: string })?.name ===
        'CellSelection';
      const inTable = editor.isActive('table');
      if (!inTable || (!selection.empty && !isCellSelection)) {
        setRect(null);
        return;
      }

      for (let d = $anchor.depth; d >= 0; d -= 1) {
        if ($anchor.node(d).type.name === 'table') {
          const pos = $anchor.before(d);
          const dom = view.nodeDOM(pos);
          if (dom instanceof HTMLElement) {
            setRect(dom.getBoundingClientRect());
            return;
          }
        }
      }
      setRect(null);
    };

    const bump = () => {
      // Force re-read of `editor.can()` values by touching state key.
      setSelectionKey((k) => k + 1);
      update();
    };

    update();
    editor.on('selectionUpdate', bump);
    editor.on('transaction', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);
    return () => {
      editor.off('selectionUpdate', bump);
      editor.off('transaction', update);
      window.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    };
  }, [editor]);

  if (!rect) return null;

  // Re-read capability flags — `selectionKey` forces this to run after each
  // selection change even though we don't read it directly.
  void selectionKey;
  const inTable = editor.isActive('table');
  const canMerge = editor.can().mergeCells();
  const canSplit = editor.can().splitCell();

  // Position: 10px gap above the table. If no room above (rect.top < 50),
  // flip to below the table.
  const TOOLBAR_HEIGHT = 40;
  const GAP = 10;
  const above = rect.top - TOOLBAR_HEIGHT - GAP;
  const below = rect.bottom + GAP;
  const useBelow = above < 8;
  const top = useBelow ? below : above;
  const left = Math.max(8, rect.left);

  const style: CSSProperties = {
    position: 'fixed',
    top,
    left,
    zIndex: 40,
  };

  return createPortal(
    <div
      style={style}
      className="flex items-center gap-0.5 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-1)] p-1 shadow-md"
      // Prevent clicks on the toolbar from blurring the editor selection.
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().addRowBefore().run()}
        disabled={!inTable}
        icon={<ArrowUpToLine size={16} />}
        title="위에 행 추가"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().addRowAfter().run()}
        disabled={!inTable}
        icon={<ArrowDownToLine size={16} />}
        title="아래에 행 추가"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().deleteRow().run()}
        disabled={!inTable}
        icon={<Rows size={16} />}
        title="행 삭제"
        tone="danger"
      />

      <div className="mx-0.5 h-5 w-px bg-[color:var(--border-subtle)]" />

      <ToolbarButton
        onClick={() => editor.chain().focus().addColumnBefore().run()}
        disabled={!inTable}
        icon={<ArrowLeftToLine size={16} />}
        title="왼쪽에 열 추가"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().addColumnAfter().run()}
        disabled={!inTable}
        icon={<ArrowRightToLine size={16} />}
        title="오른쪽에 열 추가"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().deleteColumn().run()}
        disabled={!inTable}
        icon={<Columns size={16} />}
        title="열 삭제"
        tone="danger"
      />

      <div className="mx-0.5 h-5 w-px bg-[color:var(--border-subtle)]" />

      <ToolbarButton
        onClick={() => editor.chain().focus().mergeCells().run()}
        disabled={!canMerge}
        icon={<Combine size={16} />}
        title="셀 병합 (여러 셀을 드래그로 선택 후)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().splitCell().run()}
        disabled={!canSplit}
        icon={<Split size={16} />}
        title="셀 분리 (병합된 셀에서)"
      />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeaderRow().run()}
        disabled={!inTable}
        icon={<span className="text-[11px] font-semibold">Hdr</span>}
        title="헤더 행 토글"
      />

      <div className="mx-0.5 h-5 w-px bg-[color:var(--border-subtle)]" />

      <ToolbarButton
        onClick={() => editor.chain().focus().deleteTable().run()}
        disabled={!inTable}
        icon={<Trash2 size={16} />}
        title="표 삭제"
        tone="danger"
      />
    </div>,
    document.body,
  );
}
