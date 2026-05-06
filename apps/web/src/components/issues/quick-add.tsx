import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { IssueOutput } from '@worknest/shared';
import { toast } from '@worknest/ui';
import { CircleCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { type TemplateApply, TemplatePicker } from './template-picker';

interface QuickAddProps {
  projectId: string;
  parentId?: string;
  defaultStatusId?: string;
  onCreated?: (issue: IssueOutput) => void;
  onClose?: () => void;
}

export function QuickAdd({
  projectId,
  parentId,
  defaultStatusId,
  onCreated,
  onClose,
}: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<TemplateApply | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: {
      title: string;
      parentId?: string;
      statusId?: string;
      description?: unknown;
      priority?: TemplateApply['priority'];
      typeId?: string;
      labelIds?: string[];
    }) => apiClient.post<IssueOutput>(`/projects/${projectId}/issues`, data),
    onSuccess: (created) => {
      // Invalidate all issue queries for this project (list, board, stats, etc.)
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'issues'],
      });
      queryClient.invalidateQueries({
        queryKey: ['projects', projectId, 'board-issues'],
      });
      if (parentId) {
        queryClient.invalidateQueries({
          queryKey: ['projects', projectId, 'issues', parentId, 'sub-issues'],
        });
      }
      onCreated?.(created);
    },
    onError: () => {
      toast('이슈 생성에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function handleApplyTemplate(apply: TemplateApply) {
    setTemplate(apply);
    if (apply.titleTemplate && !title) {
      setTitle(apply.titleTemplate);
    }
    inputRef.current?.focus();
    // Place cursor at end after the prefix
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }

  function handleSubmit(keepOpen: boolean) {
    const trimmed = title.trim();
    if (!trimmed) return;

    createMutation.mutate({
      title: trimmed,
      ...(parentId ? { parentId } : {}),
      ...(defaultStatusId ? { statusId: defaultStatusId } : {}),
      ...(template?.body ? { description: template.body } : {}),
      ...(template?.priority ? { priority: template.priority } : {}),
      ...(template?.typeId ? { typeId: template.typeId } : {}),
      ...(template?.labelIds && template.labelIds.length > 0
        ? { labelIds: template.labelIds }
        : {}),
    });

    setTitle('');
    setTemplate(null);

    if (keepOpen) {
      inputRef.current?.focus();
    } else {
      onClose?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Ignore Enter during IME composition (e.g. Korean input)
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      // Enter: create and keep Quick Add open (continuous creation)
      // Shift+Enter: create and close
      handleSubmit(!e.shiftKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitle('');
      setTemplate(null);
      onClose?.();
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    // Don't close if focus moved to template picker dropdown within this row
    const next = e.relatedTarget as HTMLElement | null;
    if (next && e.currentTarget.parentElement?.contains(next)) return;

    const trimmed = title.trim();
    if (trimmed) {
      handleSubmit(false);
    } else {
      onClose?.();
    }
  }

  return (
    <div
      role="form"
      aria-label="이슈 빠른 생성"
      className="flex h-10 items-center gap-1 rounded-xl bg-card px-3 shadow-sm ring-2 ring-primary/30"
    >
      <CircleCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="이슈 제목을 입력하세요..."
        aria-label="이슈 제목"
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      <TemplatePicker
        projectId={projectId}
        selectedId={template?.templateId ?? null}
        onApply={handleApplyTemplate}
        onClear={() => setTemplate(null)}
      />
    </div>
  );
}
