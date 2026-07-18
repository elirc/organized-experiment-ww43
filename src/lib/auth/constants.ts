/**
 * Holds auth-specific constants shared across cookie handling and session logic.
 * Called by session helpers and auth routes.
 * A junior engineer often duplicates cookie names or TTLs in multiple files,
 * which causes login/logout mismatches that are frustrating to debug.
 */
export const SESSION_TTL_DAYS = 14;
