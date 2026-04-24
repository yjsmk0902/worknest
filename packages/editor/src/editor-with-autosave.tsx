import type { JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Editor, type EditorProps } from './editor';

export type SaveStatus = 'saved' | 'saving' | 'unsaved';

export interface EditorWithAutosaveProps {
  /** Initial TipTap JSON content */
  content: JSONContent | null;
  /** Called to persist content. Should throw on failure. */
  onSave: (json: JSONContent, text: string) => Promise<void>;
  /** Debounce interval in milliseconds (default: 2000) */
  debounceMs?: number;
  /** Whether the editor is editable (default: true) */
  editable?: boolean;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Additional CSS class names */
  className?: string;
  /** Whether to autofocus the editor on mount */
  autofocus?: boolean;
  /** Additional TipTap extensions */
  extensions?: EditorProps['extensions'];
  /** Forwarded to the inner Editor — called with the TipTap instance. */
  onEditor?: EditorProps['onEditor'];
  /** Custom status labels (e.g., for i18n) */
  statusLabels?: {
    saved?: string;
    saving?: string;
    unsaved?: string;
  };
  /**
   * Notified whenever the save status changes. Consumers can hook this up
   * to render their own status indicator outside the editor body.
   */
  onStatusChange?: (status: SaveStatus) => void;
  /** Hide the built-in floating status indicator (default false). */
  hideStatus?: boolean;
}

const DEFAULT_LABELS: Record<SaveStatus, string> = {
  saved: 'Saved',
  saving: 'Saving...',
  unsaved: 'Unsaved changes',
};

/**
 * Editor wrapper with debounced auto-save functionality.
 *
 * Automatically saves content after a configurable debounce period.
 * Shows a status indicator and flushes pending saves on unmount.
 */
export function EditorWithAutosave({
  content,
  onSave,
  debounceMs = 2000,
  editable = true,
  placeholder,
  className,
  autofocus,
  extensions,
  statusLabels,
  onStatusChange,
  hideStatus = false,
  onEditor,
}: EditorWithAutosaveProps) {
  const [status, setStatusState] = useState<SaveStatus>('saved');
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const setStatus = useCallback((next: SaveStatus) => {
    setStatusState(next);
    onStatusChangeRef.current?.(next);
  }, []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ json: JSONContent; text: string } | null>(null);
  const onSaveRef = useRef(onSave);
  const mountedRef = useRef(true);

  // Keep onSave ref current to avoid stale closures
  onSaveRef.current = onSave;

  const labels = { ...DEFAULT_LABELS, ...statusLabels };

  const flushSave = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;

    pendingRef.current = null;

    if (mountedRef.current) {
      setStatus('saving');
    }

    try {
      await onSaveRef.current(pending.json, pending.text);
      if (mountedRef.current) {
        setStatus('saved');
      }
    } catch {
      // Restore pending data so it can be retried
      pendingRef.current = pending;
      if (mountedRef.current) {
        setStatus('unsaved');
      }
    }
  }, []);

  const handleUpdate = useCallback(
    (json: JSONContent, text: string) => {
      pendingRef.current = { json, text };
      setStatus('unsaved');

      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Schedule save after debounce
      timerRef.current = setTimeout(() => {
        void flushSave();
      }, debounceMs);
    },
    [debounceMs, flushSave],
  );

  // Flush pending save on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // Synchronously attempt to save any pending changes
      const pending = pendingRef.current;
      if (pending) {
        // Fire-and-forget save on unmount
        void onSaveRef.current(pending.json, pending.text);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Editor
        content={content}
        onUpdate={handleUpdate}
        editable={editable}
        placeholder={placeholder}
        className={className}
        autofocus={autofocus}
        extensions={extensions}
        onEditor={onEditor}
      />

      {/* Save status indicator (hidden when consumer renders their own) */}
      {editable && !hideStatus && (
        <div className="absolute top-2 right-2 pointer-events-none">
          <span
            className={[
              'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md',
              status === 'saved'
                ? 'text-muted-foreground'
                : status === 'saving'
                  ? 'text-muted-foreground'
                  : 'text-amber-600 dark:text-amber-400',
            ].join(' ')}
          >
            {/* Status dot */}
            <span
              className={[
                'w-1.5 h-1.5 rounded-full',
                status === 'saved'
                  ? 'bg-emerald-500'
                  : status === 'saving'
                    ? 'bg-muted-foreground animate-pulse'
                    : 'bg-amber-500',
              ].join(' ')}
            />
            {labels[status]}
          </span>
        </div>
      )}
    </div>
  );
}
