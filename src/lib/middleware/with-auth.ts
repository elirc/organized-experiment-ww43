/**
 * Wraps API handlers with authenticated session resolution.
 * Called by route files under src/app/api.
 * A junior engineer often repeats session checks in every route, which leads
 * to inconsistent 401 behavior and makes authorization harder to audit.
 */
import type { NextRequest } from "next/server";

import { ok } from "@/lib/http/api-response";
import { resolveRequestSession } from "@/lib/auth/session";
import type { AppSession } from "@/types/auth";

type AuthedRouteContext = {
  session: AppSession;
};

type SessionResolver = typeof resolveRequestSession;

export type AuthedRouteHandler = (
  request: NextRequest,
  context: AuthedRouteContext,
) => Promise<Response>;

export const withAuth = (
  handler: AuthedRouteHandler,
  deps: { resolveSession?: SessionResolver } = {},
) => {
  const resolveSession = deps.resolveSession ?? resolveRequestSession;

  return async (request: NextRequest) => {
    const session = await resolveSession(request);
    if (!session) {
      return ok(
        {
          error: "UNAUTHENTICATED",
          message: "You must sign in before calling this endpoint.",
        },
        401,
      );
    }

    return handler(request, { session });
  };
};
