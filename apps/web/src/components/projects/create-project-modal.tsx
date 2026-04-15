import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@worknest/ui';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { toast } from '@worknest/ui';
import { AlertTriangle, Check, Folder, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/api-client';

interface CreateProjectModalProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CheckPrefixResult {
  available: boolean;
}

/**
 * Generate a prefix from a project name.
 * - Multi-word: first letter of each word, uppercase, 2-5 chars
 * - Single word: first 3 uppercase chars
 * - Non-latin: empty (user must type manually)
 */
function generatePrefix(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';

  // Split by spaces
  const words = trimmed.split(/\s+/).filter(Boolean);
  let result: string;

  if (words.length >= 2) {
    result = words
      .map((w) => w.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 5);
  } else {
    // Single word - take first 3 chars
    result = trimmed.slice(0, 3).toUpperCase();
  }

  // Only keep A-Z
  return result.replace(/[^A-Z]/g, '').slice(0, 5);
}

const PREFIX_REGEX = /^[A-Z]{2,5}$/;

export function CreateProjectModal({ workspaceId, open, onOpenChange }: CreateProjectModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [description, setDescription] = useState('');
  const [prefixManuallyEdited, setPrefixManuallyEdited] = useState(false);
  const [debouncedPrefix, setDebouncedPrefix] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setName('');
      setPrefix('');
      setDescription('');
      setPrefixManuallyEdited(false);
      setDebouncedPrefix('');
    }
  }, [open]);

  // Debounce prefix for availability check
  const debouncePrefixCheck = useCallback((value: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedPrefix(value);
    }, 300);
  }, []);

  // Auto-generate prefix from name
  function handleNameChange(value: string) {
    setName(value);
    if (!prefixManuallyEdited) {
      const generated = generatePrefix(value);
      setPrefix(generated);
      debouncePrefixCheck(generated);
    }
  }

  // Manual prefix editing
  function handlePrefixChange(value: string) {
    const upper = value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 5);
    setPrefix(upper);
    setPrefixManuallyEdited(true);
    debouncePrefixCheck(upper);
  }

  // Prefix availability check
  const prefixCheckQuery = useQuery<CheckPrefixResult>({
    queryKey: ['check-prefix', workspaceId, debouncedPrefix],
    queryFn: () =>
      apiClient.get(`/workspaces/${workspaceId}/projects/check-prefix`, {
        prefix: debouncedPrefix,
      }),
    enabled: PREFIX_REGEX.test(debouncedPrefix),
    staleTime: 10_000,
  });

  const isPrefixValid = PREFIX_REGEX.test(prefix);
  const isPrefixAvailable = prefixCheckQuery.data?.available === true;
  const isPrefixChecking = prefixCheckQuery.isFetching || prefix !== debouncedPrefix;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      prefix: string;
      description?: string | null;
    }) => apiClient.post(`/workspaces/${workspaceId}/projects`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'projects'],
      });
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'projects', 'sidebar'],
      });
      toast('프로젝트가 생성되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast('프로젝트 생성에 실패했습니다. 다시 시도해주세요.');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !isPrefixValid || !isPrefixAvailable) return;

    createMutation.mutate({
      name: name.trim(),
      prefix,
      description: description.trim() || null,
    });
  }

  const canSubmit =
    name.trim().length > 0 &&
    isPrefixValid &&
    isPrefixAvailable &&
    !isPrefixChecking &&
    !createMutation.isPending;

  const isLoading = createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>프로젝트 만들기</DialogTitle>
        </DialogHeader>

        {createMutation.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Icon */}
          <div className="space-y-2">
            <Label>아이콘</Label>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Folder className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">프로젝트 이름 *</Label>
            <Input
              id="project-name"
              placeholder="프로젝트 이름을 입력하세요"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isLoading}
              maxLength={100}
            />
          </div>

          {/* Prefix */}
          <div className="space-y-2">
            <Label htmlFor="project-prefix">접두사 *</Label>
            <Input
              id="project-prefix"
              placeholder="PROJ"
              value={prefix}
              onChange={(e) => handlePrefixChange(e.target.value)}
              disabled={isLoading}
              maxLength={5}
              className="font-mono uppercase"
            />
            {/* Prefix status indicator */}
            {prefix.length > 0 && (
              <div className="flex items-center gap-1">
                {!isPrefixValid && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <X className="h-3 w-3" />
                    영문 대문자 2~5자로 입력해주세요
                  </p>
                )}
                {isPrefixValid && isPrefixChecking && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    확인 중...
                  </p>
                )}
                {isPrefixValid && !isPrefixChecking && isPrefixAvailable && (
                  <p className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <Check className="h-3 w-3" />
                    사용 가능
                  </p>
                )}
                {isPrefixValid &&
                  !isPrefixChecking &&
                  prefixCheckQuery.isSuccess &&
                  !isPrefixAvailable && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <X className="h-3 w-3" />
                      이미 사용 중인 접두사입니다
                    </p>
                  )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="project-desc">설명</Label>
            <textarea
              id="project-desc"
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="프로젝트 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                '프로젝트 만들기'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
