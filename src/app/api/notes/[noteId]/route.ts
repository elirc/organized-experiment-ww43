/**
 * Reads one note or updates it using optimistic concurrency.
 * Called by src/features/notes/hooks/use-note-detail.ts and use-save-note.ts.
 * Calls src/lib/middleware/with-auth.ts, src/lib/validation/note-schemas.ts,
 * and src/services/note-service.ts.
 * A junior engineer often accepts updates without a base version, which turns
 * concurrent edits into silent data loss.
 */
import type { NextRequest } from "next/server";

import { apiError, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { noteIdParamsSchema, updateNoteSchema } from "@/lib/validation/note-schemas";
import { parseSchema } from "@/lib/validation/parse-schema";
import { noteService } from "@/services/note-service";

type RouteContext = {
  params: Promise<{ noteId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(async (_request, { session }) => {
    try {
      const { noteId } = parseSchema(noteIdParamsSchema, await context.params);
      const note = await noteService.getNoteDetail(session, noteId);
      return ok({ note });
    } catch (error) {
      return apiError(error);
    }
  })(request);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withAuth(async (innerRequest, { session }) => {
    try {
      const { noteId } = parseSchema(noteIdParamsSchema, await context.params);
      const input = parseSchema(updateNoteSchema, await innerRequest.json());
      const note = await noteService.updateNote(session, noteId, input);
      return ok({ note });
    } catch (error) {
      return apiError(error);
    }
  })(request);
}

// ⚠️ SENIOR NOTE: The route only parses params/body and hands off to the service;
// conflict behavior must stay centralized or different write paths will drift.
