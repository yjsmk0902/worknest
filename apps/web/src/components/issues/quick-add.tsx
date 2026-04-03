import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck } from 'lucide-react';
import { toast } from '@worknest/ui';
import { apiClient } from '../../lib/api-client';
import type { IssueOutput } from '@worknest/shared';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: { title: string; parentId?: string; statusId?: string }) =>
      apiClient.post<IssueOutput>(
        `/projects/${projectId}/issues`,
        data,
      ),
    onMutate: async (newIssue) => {
      const queryKey = parentId
        ? ['projects', projectId, 'issues', parentId, 'sub-issues']
        : ['projects', projectId, 'issues'];

      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      const tempIssue: IssueOutput = {
        id: `temp-${crypto.randomUUID()}`,
        projectId,
        sequenceId: 0,
        title: newIssue.title,
        description: null,
        descriptionText: null,
        statusId: defaultStatusId ?? null,
        typeId: null,
        priority: 'none',
        parentId: parentId ?? null,
        creatorId: null,
        sortOrder: '',
        dueDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData(queryKey, (old: unknown) => {
        if (old && typeof old === 'object' && 'data' in old) {
          const oldList = old as { data: IssueOutput[] };
          return { ...oldList, data: [tempIssue, ...oldList.data] };
        }
        return old;
      });

      return { previousData, queryKey };
    },
    onSuccess: (created, _variables, context) => {
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
      onCreated?.(created);
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
      toast('이슈 생성에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function handleSubmit(keepOpen: boolean) {
    const trimmed = title.trim();
    if (!trimmed) return;

    createMutation.mutate({
      title: trimmed,
      ...(parentId ? { parentId } : {}),
      ...(defaultStatusId ? { statusId: defaultStatusId } : {}),
    });

    setTitle('');

    if (keepOpen) {
      inputRef.current?.focus();
    } else {
      onClose?.();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Enter: create and keep Quick Add open (continuous creation)
      // Shift+Enter: create and close
      handleSubmit(!e.shiftKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitle('');
      onClose?.();
    }
  }

  function handleBlur() {
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
      className="flex h-10 items-center gap-2 rounded-md bg-card px-3 ring-2 ring-ring"
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
        autoFocus
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
