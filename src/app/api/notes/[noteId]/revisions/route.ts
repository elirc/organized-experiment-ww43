/**
 * Lists full revision history for a note the caller can access.
 * Called by src/features/notes/hooks/use-note-revisions.ts.
 * Calls src/lib/middleware/with-auth.ts, src/lib/validation/note-schemas.ts,
 * and src/services/note-service.ts.
 * A junior engineer often forgets to scope history endpoints with the same
 * access filter as the live record, leaking past document contents.
 */
import type { NextRequest } from "next/server";

import { apiError, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { noteIdParamsSchema } from "@/lib/validation/note-schemas";
import { parseSchema } from "@/lib/validation/parse-schema";
import { noteService } from "@/services/note-service";

type RouteContext = {
  params: Promise<{ noteId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(async (_request, { session }) => {
    try {
      const { noteId } = parseSchema(noteIdParamsSchema, await context.params);
      const revisions = await noteService.listRevisions(session, noteId);
      return ok({ revisions });
    } catch (error) {
      return apiError(error);
    }
  })(request);
}

// ⚠️ SENIOR NOTE: Revision history can contain previously-deleted sensitive text,
// so it must share the same authorization boundary as the note itself.
