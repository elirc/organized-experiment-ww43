/**
 * Zod schemas for the auth HTTP boundary.
 * Called by auth route handlers before services execute business logic.
 * A junior engineer often validates only in the browser, which allows invalid
 * payloads to hit the backend directly through scripts or broken clients.
 */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ⚠️ SENIOR NOTE: Lowercasing at the boundary prevents duplicate identities like
// User@corp.com and user@corp.com from drifting apart operationally.
