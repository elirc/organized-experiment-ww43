/**
 * Changes a note between ACTIVE and ARCHIVED states.
 * Called by src/features/notes/hooks/use-note-status.ts.
 * Calls src/lib/middleware/with-auth.ts, src/lib/validation/note-schemas.ts,
 * and src/services/note-service.ts.
 * A junior engineer often treats archive actions as a UI toggle, but they are
 * business-state transitions that must be enforced on the server.
 */
import type { NextRequest } from "next/server";

import { apiError, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { noteIdParamsSchema, noteStatusSchema } from "@/lib/validation/note-schemas";
import { parseSchema } from "@/lib/validation/parse-schema";
import { noteService } from "@/services/note-service";

type RouteContext = {
  params: Promise<{ noteId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  return withAuth(async (innerRequest, { session }) => {
    try {
      const { noteId } = parseSchema(noteIdParamsSchema, await context.params);
      const input = parseSchema(noteStatusSchema, await innerRequest.json());
      const note = await noteService.updateStatus(session, noteId, input.status);
      return ok({ note });
    } catch (error) {
      return apiError(error);
    }
  })(request);
}

// ⚠️ SENIOR NOTE: Status transitions belong on their own endpoint because they
// carry different permission and state rules than ordinary content edits.
