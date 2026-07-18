/**
 * Zod schemas for note CRUD, sharing, and conflict-safe updates.
 * Called by note route handlers before any service or repository work happens.
 * A junior engineer often omits version checks from validation entirely, which
 * turns conflict handling into a best-effort convention instead of a guarantee.
 */
import { NotePermission, NoteStatus } from "@prisma/client";
import { z } from "zod";

export const noteIdParamsSchema = z.object({
  noteId: z.string().min(1),
});

export const createNoteSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(20000),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(20000),
  baseVersionNumber: z.number().int().positive(),
  changeSummary: z.string().trim().max(160).optional(),
});

export const shareNoteSchema = z.object({
  email: z.email().trim().toLowerCase(),
  permission: z.enum(NotePermission),
});

export const noteStatusSchema = z.object({
  status: z.enum(NoteStatus),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ShareNoteInput = z.infer<typeof shareNoteSchema>;
export type UpdateNoteStatusInput = z.infer<typeof noteStatusSchema>;

// ⚠️ SENIOR NOTE: Keeping body length limits server-side avoids accidental large
// writes that can bloat revision history tables and degrade query latency.
