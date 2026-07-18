/**
 * Centralizes runtime configuration so services and repositories can depend on
 * a typed boundary instead of raw process.env reads.
 * Called by auth/session helpers and prisma bootstrap code.
 * A junior engineer often scatters environment reads across files, which makes
 * production defaults inconsistent and hard to audit.
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/collab_notes"),
  SESSION_SECRET: z
    .string()
    .min(16)
    .default("dev-session-secret-change-me"),
  SESSION_COOKIE_NAME: z.string().min(1).default("collab_notes_session"),
});

// ⚠️ SENIOR NOTE: Defaults keep local builds runnable, but production should
// override them explicitly; hidden env drift is a common deployment foot-gun.
export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
});
