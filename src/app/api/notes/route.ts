/**
 * Lists accessible notes and creates new ones for the signed-in user.
 * Called by src/features/notes/hooks/use-notes.ts.
 * Calls src/lib/middleware/with-auth.ts, src/lib/validation/note-schemas.ts,
 * and src/services/note-service.ts.
 * A junior engineer often lets the client send owner ids on create, which opens
 * the door to impersonation and cross-account writes.
 */
import type { NextRequest } from "next/server";

import { apiError, created, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { createNoteSchema } from "@/lib/validation/note-schemas";
import { parseSchema } from "@/lib/validation/parse-schema";
import { noteService } from "@/services/note-service";

export const GET = withAuth(async (_request, { session }) => {
  try {
    const notes = await noteService.listNotes(session);
    return ok({ notes });
  } catch (error) {
    return apiError(error);
  }
});

export const POST = withAuth(async (request: NextRequest, { session }) => {
  try {
    const input = parseSchema(createNoteSchema, await request.json());
    const note = await noteService.createNote(session, input);
    return created({ note });
  } catch (error) {
    return apiError(error);
  }
});

// ⚠️ SENIOR NOTE: Ownership comes from the authenticated session, never the
// request body, because identity must be server-derived.
