/**
 * Signs a user in by validating credentials and issuing a session cookie.
 * Called by src/features/auth/hooks/use-login-mutation.ts.
 * Calls src/lib/validation/auth-schemas.ts, src/services/auth-service.ts, and
 * src/lib/auth/session.ts.
 * A junior engineer often sets cookies before credential verification succeeds,
 * which can leave stale or forged session state around the browser.
 */
import type { NextRequest } from "next/server";

import { attachSessionCookie } from "@/lib/auth/session";
import { apiError, ok } from "@/lib/http/api-response";
import { parseSchema } from "@/lib/validation/parse-schema";
import { loginSchema } from "@/lib/validation/auth-schemas";
import { authService } from "@/services/auth-service";

export async function POST(request: NextRequest) {
  try {
    const input = parseSchema(loginSchema, await request.json());
    const result = await authService.login(input);
    const response = ok({ session: result.session });

    attachSessionCookie(response, result.token, result.expiresAt);
    return response;
  } catch (error) {
    return apiError(error);
  }
}

// ⚠️ SENIOR NOTE: Cookie issuance stays in the route so services remain pure
// business logic and can be tested without a Next.js response object.
