/**
 * Creates and hashes opaque session tokens used for cookie-based auth.
 * Called by auth service and session lookup logic.
 * A junior engineer often stores raw session tokens in the database, which
 * turns any read-only DB leak into an account takeover event.
 */
import { createHash, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

export const createSessionToken = () => randomBytes(32).toString("hex");

export const hashSessionToken = (token: string) =>
  createHash("sha256").update(`${token}:${env.SESSION_SECRET}`).digest("hex");

// ⚠️ SENIOR NOTE: Salting the session token hash with an app secret means a DB
// dump alone is not enough to mint valid cookies.
