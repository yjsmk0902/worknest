import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { WikiSpaceOutput } from '@worknest/shared';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@worknest/ui';
import { Button } from '@worknest/ui';
import { Input } from '@worknest/ui';
import { Label } from '@worknest/ui';
import { toast } from '@worknest/ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';

interface SpaceFormModalProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the modal is in edit mode */
  space?: WikiSpaceOutput;
}

/**
 * Generate a URL-friendly slug from a name.
 */
function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Dialog for creating or editing a wiki space.
 *
 * Provides name, slug (auto-generated from name), and description fields.
 */
export function SpaceFormModal({ workspaceId, open, onOpenChange, space }: SpaceFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!space;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (space) {
        setName(space.name);
        setSlug(space.slug);
        setDescription(space.description ?? '');
        setSlugManuallyEdited(true);
      } else {
        setName('');
        setSlug('');
        setDescription('');
        setSlugManuallyEdited(false);
      }
    }
  }, [open, space]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 50);
    setSlug(sanitized);
    setSlugManuallyEdited(true);
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      slug: string;
      description?: string;
    }) => apiClient.post<WikiSpaceOutput>(`/workspaces/${workspaceId}/wiki-spaces`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'wiki-spaces'],
      });
      toast(isEditing ? '스페이스가 수정되었습니다.' : '스페이스가 생성되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast(isEditing ? '스페이스 수정에 실패했습니다.' : '스페이스 생성에 실패했습니다.');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string;
      slug?: string;
      description?: string | null;
    }) => apiClient.patch(`/wiki-spaces/${space?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['workspaces', workspaceId, 'wiki-spaces'],
      });
      queryClient.invalidateQueries({
        queryKey: ['wiki-spaces', space?.id],
      });
      toast('스페이스가 수정되었습니다.');
      onOpenChange(false);
    },
    onError: () => {
      toast('스페이스 수정에 실패했습니다.');
    },
  });

  const mutation = isEditing ? updateMutation : createMutation;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    const data = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const canSubmit = name.trim().length > 0 && slug.trim().length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '스페이스 수정' : '스페이스 만들기'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="space-name">이름 *</Label>
            <Input
              id="space-name"
              placeholder="스페이스 이름"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={mutation.isPending}
              maxLength={100}
              autoFocus
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="space-slug">슬러그 *</Label>
            <Input
              id="space-slug"
              placeholder="space-slug"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={mutation.isPending}
              maxLength={50}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              URL에 사용됩니다. 영문 소문자, 숫자, 하이픈만 허용됩니다.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="space-desc">설명</Label>
            <textarea
              id="space-desc"
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="스페이스 설명 (선택)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              취소
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEditing ? '수정 중...' : '생성 중...'}
                </>
              ) : isEditing ? (
                '수정'
              ) : (
                '만들기'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
