import { useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import { MoreHorizontal, Pencil, Reply, Trash2 } from 'lucide-react';
import {
  Avatar,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@worknest/ui';
import type { JSONContent } from '@tiptap/core';
import type { MentionQueryFn } from '@worknest/editor';
import { CommentEditor } from './comment-editor';
import { Reactions } from './reactions';

// ── Types ──────────────────────────────────────────────────────────────

interface ReactionData {
  id: string;
  commentId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface CommentData {
  id: string;
  issueId: string | null;
  pageId: string | null;
  content: unknown;
  parentId: string | null;
  authorId: string | null;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactions: ReactionData[];
}

interface CommentItemProps {
  comment: CommentData;
  currentUserId: string;
  /** Whether this is a reply (child comment) */
  isReply?: boolean;
  onEdit: (commentId: string, content: JSONContent) => void;
  onDelete: (commentId: string) => void;
  onReply: (parentId: string) => void;
  onReactionToggle: (commentId: string, emoji: string) => void;
  /** Mention query function for the comment editor */
  mentionQueryFn?: MentionQueryFn;
}

// ── Relative time ──────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}주 전`;

  return date.toLocaleDateString('ko-KR');
}

// ── Read-only renderer ─────────────────────────────────────────────────

function CommentContent({ content }: { content: unknown }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
      }),
      LinkExtension.configure({
        autolink: false,
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-2 cursor-pointer hover:text-primary/80',
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: content as JSONContent,
    editable: false,
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_.mention]:text-primary [&_.mention]:font-medium [&_.mention]:cursor-pointer [&_.mention]:hover:underline">
      <EditorContent editor={editor} />
    </div>
  );
}

// ── CommentItem ────────────────────────────────────────────────────────

export function CommentItem({
  comment,
  currentUserId,
  isReply = false,
  onEdit,
  onDelete,
  onReply,
  onReactionToggle,
  mentionQueryFn,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isAuthor = comment.authorId === currentUserId;
  const authorName = comment.author?.name ?? '알 수 없는 사용자';
  const avatarSize = isReply ? 'sm' : 'sm';

  const handleEditSubmit = (content: JSONContent) => {
    onEdit(comment.id, content);
    setEditing(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(comment.id);
    setDeleteDialogOpen(false);
  };

  return (
    <div
      className={cn(
        'group relative',
        isReply && 'ml-8 border-l-2 border-border pl-4',
      )}
      role="article"
      aria-label={`${authorName} 댓글`}
    >
      <div className="flex items-start gap-2">
        {/* Avatar */}
        <Avatar
          src={comment.author?.avatarUrl ?? null}
          fallback={authorName}
          size={avatarSize}
          className={cn('mt-0.5 shrink-0', isReply && 'h-6 w-6')}
        />

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {authorName}
            </span>
            <span className="text-muted-foreground mx-0.5">&middot;</span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
            {comment.createdAt !== comment.updatedAt && (
              <span className="text-xs text-muted-foreground">(수정됨)</span>
            )}
            {editing && (
              <span className="text-xs text-muted-foreground">(수정 중)</span>
            )}

            {/* More menu - hover visible */}
            <div className="ml-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                    aria-label="댓글 메뉴"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  {!isReply && (
                    <DropdownMenuItem onClick={() => onReply(comment.id)}>
                      <Reply size={16} />
                      답글
                    </DropdownMenuItem>
                  )}
                  {isAuthor && (
                    <>
                      <DropdownMenuItem onClick={() => setEditing(true)}>
                        <Pencil size={16} />
                        수정
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 size={16} />
                        삭제
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Reply reference */}
          {isReply && comment.parentId && (
            <p className="mt-0.5 text-xs italic text-muted-foreground">
              &rarr; 원본 댓글에 답글
            </p>
          )}

          {/* Body */}
          <div className="mt-1">
            {editing ? (
              <CommentEditor
                initialContent={comment.content as JSONContent}
                onSubmit={handleEditSubmit}
                onCancel={() => setEditing(false)}
                submitLabel="저장"
                mentionQueryFn={mentionQueryFn}
                autofocus
              />
            ) : (
              <CommentContent content={comment.content} />
            )}
          </div>

          {/* Reactions */}
          {!editing && (
            <div className="mt-2">
              <Reactions
                reactions={comment.reactions}
                currentUserId={currentUserId}
                onToggle={(emoji) => onReactionToggle(comment.id, emoji)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm" role="alertdialog">
          <DialogHeader>
            <DialogTitle>댓글 삭제</DialogTitle>
            <DialogDescription>삭제하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              취소
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
