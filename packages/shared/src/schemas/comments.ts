import { z } from "zod";

// ── Allowed Emojis ──────────────────────────────────────────────────────

export const ALLOWED_EMOJIS = [
  "👍",
  "❤️",
  "😄",
  "👀",
  "🚀",
  "🎉",
  "😕",
  "👎",
  "✅",
  "❌",
  "🔥",
  "💯",
  "🙏",
  "😱",
  "💡",
  "🤔",
  "😂",
  "🥳",
  "👏",
  "🙌",
] as const;

// ── Comment Input ───────────────────────────────────────────────────────

export const createCommentInput = z.object({
  content: z.unknown(), // TipTap JSON (validated server-side)
  parentId: z.string().uuid().optional(), // flat 1-level threading
});

export type CreateCommentInput = z.infer<typeof createCommentInput>;

export const updateCommentInput = z.object({
  content: z.unknown(),
});

export type UpdateCommentInput = z.infer<typeof updateCommentInput>;

// ── Comment Output ──────────────────────────────────────────────────────

export const commentOutput = z.object({
  id: z.string().uuid(),
  issueId: z.string().uuid().nullable(),
  pageId: z.string().uuid().nullable(),
  content: z.unknown(),
  parentId: z.string().uuid().nullable(),
  authorId: z.string().uuid().nullable(),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CommentOutput = z.infer<typeof commentOutput>;

// ── Reaction Input ──────────────────────────────────────────────────────

export const toggleReactionInput = z.object({
  emoji: z.enum(ALLOWED_EMOJIS),
});

export type ToggleReactionInput = z.infer<typeof toggleReactionInput>;

// ── Reaction Output ─────────────────────────────────────────────────────

export const reactionOutput = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
  userId: z.string().uuid(),
  emoji: z.string(),
  createdAt: z.string(),
});

export type ReactionOutput = z.infer<typeof reactionOutput>;
