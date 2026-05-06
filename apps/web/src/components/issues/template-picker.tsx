import { useQuery } from '@tanstack/react-query';
import type { IssueTemplateOutput, Priority } from '@worknest/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@worknest/ui';
import { Check, FileText } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

export interface TemplateApply {
  templateId: string | null;
  titleTemplate: string;
  body: unknown | null;
  priority: Priority;
  typeId: string | null;
  labelIds: string[];
}

interface TemplatePickerProps {
  projectId: string;
  selectedId?: string | null;
  onApply: (apply: TemplateApply) => void;
  onClear?: () => void;
  size?: 'sm' | 'md';
  align?: 'start' | 'end';
}

export function TemplatePicker({
  projectId,
  selectedId,
  onApply,
  onClear,
  size = 'sm',
  align = 'end',
}: TemplatePickerProps) {
  const { data } = useQuery({
    queryKey: ['projects', projectId, 'issue-templates'],
    queryFn: () =>
      apiClient.get<{ data: IssueTemplateOutput[] }>(`/projects/${projectId}/issue-templates`),
    staleTime: 60_000,
  });

  const templates = data?.data ?? [];

  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const triggerClass =
    size === 'sm'
      ? 'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      : 'inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-accent';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label="이슈 템플릿 선택">
          <FileText className={iconSize} />
          {size === 'md' && <span>템플릿</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">템플릿 선택</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            사용 가능한 템플릿이 없습니다.
          </div>
        )}
        {templates.map((t) => {
          const active = t.id === selectedId;
          return (
            <DropdownMenuItem
              key={t.id}
              onSelect={() =>
                onApply({
                  templateId: t.id,
                  titleTemplate: t.titleTemplate,
                  body: t.body ?? null,
                  priority: t.priority,
                  typeId: t.typeId,
                  labelIds: t.labelIds,
                })
              }
              className="flex flex-col items-start gap-0.5"
            >
              <span className="flex w-full items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{t.name}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
              {t.description && (
                <span className="line-clamp-1 text-xs text-muted-foreground">{t.description}</span>
              )}
            </DropdownMenuItem>
          );
        })}
        {selectedId && onClear && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onClear()} className="text-xs text-muted-foreground">
              템플릿 적용 해제
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
