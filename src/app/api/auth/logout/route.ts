/**
 * Logs the current session out and clears the session cookie.
 * Called by src/features/auth/hooks/use-logout-mutation.ts and the notes UI.
 * Calls src/lib/middleware/with-auth.ts, src/services/auth-service.ts, and
 * src/lib/auth/session.ts.
 * A junior engineer often forgets to delete the backing session row, which
 * leaves logout as a client-only illusion.
 */
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { clearSessionCookie } from "@/lib/auth/session";
import { apiError, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { authService } from "@/services/auth-service";

export const POST = withAuth(async (request: NextRequest, { session }) => {
  try {
    const token = request.cookies.get(env.SESSION_COOKIE_NAME)?.value;

    if (token) {
      await authService.logout({
        token,
        actorId: session.user.id,
      });
    }

    const response = ok({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
});

// ⚠️ SENIOR NOTE: The server clears both DB state and browser state; doing only
// one of those creates hard-to-debug partial logout failures.
