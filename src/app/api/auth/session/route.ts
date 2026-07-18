/**
 * Returns the current authenticated session, or null for anonymous callers.
 * Called by React Query session hooks and login redirect logic.
 * Calls src/lib/auth/session.ts.
 * A junior engineer often makes session introspection a protected route, which
 * complicates bootstrapping the client when no one is logged in yet.
 */
import type { NextRequest } from "next/server";

import { resolveRequestSession } from "@/lib/auth/session";
import { ok } from "@/lib/http/api-response";

export async function GET(request: NextRequest) {
  const session = await resolveRequestSession(request);
  return ok({ session });
}

// ⚠️ SENIOR NOTE: Returning 200 with session:null makes client startup logic far
// simpler than treating “not logged in” as an exceptional transport failure.
