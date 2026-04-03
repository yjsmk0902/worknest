import { useEffect, useCallback } from 'react';
import { useHotkeyStore } from '../stores/hotkey-store';
import { useHotkey } from './use-hotkey';
import type { RowSelectionState } from '@tanstack/react-table';

interface UseIssueListShortcutsOptions {
  issueCount: number;
  focusedIndex: number;
  setFocusedIndex: (index: number | ((prev: number) => number)) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  getIssueId: (index: number) => string | undefined;
  onOpenFullPage: (issueId: string) => void;
  onOpenPanel: (issueId: string) => void;
  onShowQuickAdd: () => void;
}

export function useIssueListShortcuts({
  issueCount,
  focusedIndex,
  setFocusedIndex,
  rowSelection,
  onRowSelectionChange,
  getIssueId,
  onOpenFullPage,
  onOpenPanel,
  onShowQuickAdd,
}: UseIssueListShortcutsOptions) {
  const { pushContext, popContext } = useHotkeyStore();

  // Set active context to 'list' on mount
  useEffect(() => {
    pushContext('list');
    return () => {
      popContext();
    };
  }, [pushContext, popContext]);

  // J / ArrowDown: move focus to next row
  useHotkey(
    'j',
    useCallback(() => {
      setFocusedIndex((prev: number) => Math.min(prev + 1, issueCount - 1));
    }, [setFocusedIndex, issueCount]),
    { context: 'list' },
  );

  useHotkey(
    'arrowdown',
    useCallback(() => {
      setFocusedIndex((prev: number) => Math.min(prev + 1, issueCount - 1));
    }, [setFocusedIndex, issueCount]),
    { context: 'list' },
  );

  // K / ArrowUp: move focus to previous row
  useHotkey(
    'k',
    useCallback(() => {
      setFocusedIndex((prev: number) => Math.max(prev - 1, 0));
    }, [setFocusedIndex]),
    { context: 'list' },
  );

  useHotkey(
    'arrowup',
    useCallback(() => {
      setFocusedIndex((prev: number) => Math.max(prev - 1, 0));
    }, [setFocusedIndex]),
    { context: 'list' },
  );

  // Enter: open focused issue full page
  useHotkey(
    'enter',
    useCallback(() => {
      const issueId = getIssueId(focusedIndex);
      if (issueId) onOpenFullPage(issueId);
    }, [focusedIndex, getIssueId, onOpenFullPage]),
    { context: 'list' },
  );

  // Space: open focused issue side panel
  useHotkey(
    'space',
    useCallback(() => {
      const issueId = getIssueId(focusedIndex);
      if (issueId) onOpenPanel(issueId);
    }, [focusedIndex, getIssueId, onOpenPanel]),
    { context: 'list' },
  );

  // X: toggle selection on focused row (max 50)
  useHotkey(
    'x',
    useCallback(() => {
      const issueId = getIssueId(focusedIndex);
      if (!issueId) return;
      const next = { ...rowSelection };
      if (next[issueId]) {
        delete next[issueId];
      } else {
        // Enforce 50-item limit
        const currentCount = Object.keys(next).length;
        if (currentCount >= 50) return;
        next[issueId] = true;
      }
      onRowSelectionChange(next);
    }, [focusedIndex, getIssueId, rowSelection, onRowSelectionChange]),
    { context: 'list' },
  );

  // C: open Quick Add
  useHotkey(
    'c',
    useCallback(() => {
      onShowQuickAdd();
    }, [onShowQuickAdd]),
    { context: 'list' },
  );
}
