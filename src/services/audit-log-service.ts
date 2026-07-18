/**
 * Maps raw audit-log records into DTOs for admin-facing reporting.
 * Called by the admin audit-log route and page.
 * A junior engineer often returns ORM records directly, which bakes persistence
 * quirks into the UI contract and makes future migrations noisier.
 */
import { auditLogRepository } from "@/repositories/audit-log-repository";
import type { AuditLogDto } from "@/types/note";

export const auditLogService = {
  async listRecent(limit = 40): Promise<AuditLogDto[]> {
    const rows = await auditLogRepository.listRecent(limit);

    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      createdAt: row.createdAt.toISOString(),
      actor: row.actor
        ? {
            id: row.actor.id,
            name: row.actor.name,
            email: row.actor.email,
          }
        : null,
      note: row.note
        ? {
            id: row.note.id,
            title: row.note.title,
          }
        : null,
      metadata: row.metadata,
    }));
  },
};

// ⚠️ SENIOR NOTE: The admin DTO keeps metadata typed as unknown because audit
// payloads evolve; forcing a fake rigid shape here causes brittle migrations.
