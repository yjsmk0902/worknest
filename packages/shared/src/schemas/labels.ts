import { z } from "zod";

// ── Label ──────────────────────────────────────────────────────────────

export const createLabelInput = z.object({
  name: z.string().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff0000)"),
  description: z.string().max(200).nullable().optional(),
});

export type CreateLabelInput = z.infer<typeof createLabelInput>;

export const updateLabelInput = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color (e.g. #ff0000)")
    .optional(),
  description: z.string().max(200).nullable().optional(),
});

export type UpdateLabelInput = z.infer<typeof updateLabelInput>;

export const labelOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

export type LabelOutput = z.infer<typeof labelOutput>;
