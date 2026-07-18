/**
 * Lists recent audit events for application admins.
 * Called by src/features/admin/hooks or the admin page fetcher.
 * Calls src/lib/middleware/with-auth.ts, src/lib/middleware/with-role.ts, and
 * src/services/audit-log-service.ts.
 * A junior engineer often exposes audit endpoints to every authenticated user,
 * forgetting that observability data itself can reveal sensitive operations.
 */
import { apiError, ok } from "@/lib/http/api-response";
import { withAuth } from "@/lib/middleware/with-auth";
import { withRole } from "@/lib/middleware/with-role";
import { auditLogService } from "@/services/audit-log-service";

export const GET = withAuth(
  withRole(["APP_ADMIN"], async () => {
    try {
      const logs = await auditLogService.listRecent();
      return ok({ logs });
    } catch (error) {
      return apiError(error);
    }
  }),
);

// ⚠️ SENIOR NOTE: Admin-only reporting needs server-enforced role checks even if
// the route is never linked from the regular member UI.
