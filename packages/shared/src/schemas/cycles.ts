import { z } from "zod";

// ── Cycle Status ────────────────────────────────────────────────────────

export const cycleStatus = z.enum(["draft", "active", "completed"]);
export type CycleStatus = z.infer<typeof cycleStatus>;

// ── Cycle Input ─────────────────────────────────────────────────────────

export const createCycleInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateCycleInput = z.infer<typeof createCycleInput>;

export const updateCycleInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export type UpdateCycleInput = z.infer<typeof updateCycleInput>;

// ── Cycle Output ────────────────────────────────────────────────────────

export const cycleOutput = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  status: cycleStatus,
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CycleOutput = z.infer<typeof cycleOutput>;

// ── Cycle Issue Input / Output ──────────────────────────────────────────

export const addCycleIssueInput = z.object({
  issueId: z.string().uuid(),
});

export type AddCycleIssueInput = z.infer<typeof addCycleIssueInput>;

export const cycleIssueOutput = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  issueId: z.string().uuid(),
  addedAt: z.string(),
  removedAt: z.string().nullable(),
  carriedFromId: z.string().uuid().nullable(),
});

export type CycleIssueOutput = z.infer<typeof cycleIssueOutput>;

// ── Complete Cycle ──────────────────────────────────────────────────────

export const completeCycleInput = z.object({
  targetCycleId: z.string().uuid().optional(),
});

export type CompleteCycleInput = z.infer<typeof completeCycleInput>;

// ── Cycle Progress ──────────────────────────────────────────────────────

export const cycleProgressOutput = z.object({
  total: z.number(),
  completed: z.number(),
  byCategory: z.record(z.string(), z.number()),
});

export type CycleProgressOutput = z.infer<typeof cycleProgressOutput>;
