/**
 * Converts Zod parse failures into stable AppError responses for API routes.
 * Called by route handlers before handing validated input to services.
 * A junior engineer often returns raw Zod internals to clients, which couples
 * the API contract to library-specific error shapes.
 */
import type { ZodType } from "zod";

import { appError } from "@/lib/http/app-error";

export const parseSchema = <T>(schema: ZodType<T>, payload: unknown): T => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw appError(
      "The request payload did not match the expected shape.",
      422,
      "VALIDATION_ERROR",
      result.error.flatten(),
    );
  }

  return result.data;
};

// ⚠️ SENIOR NOTE: Flattened validation details are stable enough for clients to
// render while still hiding library-specific implementation details.
