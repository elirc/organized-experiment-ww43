/**
 * Enforces system-role authorization for authenticated route handlers.
 * Called by admin API routes after withAuth has resolved the session.
 * A junior engineer often checks roles in the UI only, which leaves the API
 * callable by direct requests from any logged-in user.
 */
import type { SystemRole } from "@prisma/client";
import type { NextRequest } from "next/server";

import { ok } from "@/lib/http/api-response";
import type { AuthedRouteHandler } from "@/lib/middleware/with-auth";
import type { AppSession } from "@/types/auth";

type RoleAwareHandler = (
  request: NextRequest,
  context: { session: AppSession },
) => Promise<Response>;

export const withRole = (
  allowedRoles: SystemRole[],
  handler: RoleAwareHandler,
): AuthedRouteHandler => {
  return async (request, context) => {
    if (!allowedRoles.includes(context.session.user.role)) {
      return ok(
        {
          error: "FORBIDDEN",
          message: "You do not have the required role for this endpoint.",
        },
        403,
      );
    }

    return handler(request, context);
  };
};

// ⚠️ SENIOR NOTE: System-role checks belong on the server boundary even when the
// client already hides admin links; UI affordances are not authorization.
