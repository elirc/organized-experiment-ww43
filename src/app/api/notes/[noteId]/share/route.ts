/**
 * Adds or updates a collaborator permission on a note.
 * Called by src/features/notes/hooks/use-share-note.ts.
 * Calls src/lib/middleware/with-auth.ts, src/lib/validation/note-schemas.ts,
 * and src/services/note-service.ts.
 * A junior engineer often lets editors manage collaborators, which quietly
 * turns content-edit access into access-control escalation.
 */
import type { NextRequest } from "next/server";

import { apiError, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { noteIdParamsSchema, shareNoteSchema } from "@/lib/validation/note-schemas";
import { parseSchema } from "@/lib/validation/parse-schema";
import { noteService } from "@/services/note-service";

type RouteContext = {
  params: Promise<{ noteId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return withAuth(async (innerRequest, { session }) => {
    try {
      const { noteId } = parseSchema(noteIdParamsSchema, await context.params);
      const input = parseSchema(shareNoteSchema, await innerRequest.json());
      const note = await noteService.upsertCollaborator(session, noteId, input);
      return ok({ note });
    } catch (error) {
      return apiError(error);
    }
  })(request);
}

// ⚠️ SENIOR NOTE: Sharing writes return the updated note so the client refreshes
// from server truth instead of guessing collaborator state locally.
