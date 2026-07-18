"use client";

/**
 * Displays recent audit activity for admin users.
 * Called by src/app/admin/page.tsx.
 * Calls src/features/admin/hooks/use-audit-logs.ts.
 * A junior engineer often treats admin dashboards as unimportant, but this is
 * where support and security teams validate what the system actually did.
 */
import { Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAuditLogsQuery } from "@/features/admin/hooks/use-audit-logs";

export function AuditLogView() {
  const logsQuery = useAuditLogsQuery();

  return (
    <section className="rounded-[2.2rem] border border-[var(--border)] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-[var(--accent-strong)]" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">
            Admin
          </p>
          <h1 className="text-2xl font-semibold text-[var(--ink-strong)]">Recent audit log</h1>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {logsQuery.isLoading ? <p className="text-sm text-[var(--ink-soft)]">Loading audit events...</p> : null}
        {logsQuery.data?.map((log) => (
          <article
            key={log.id}
            className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-strong)]">
                  {log.actor?.name ?? "System"} · {log.action}
                </p>
                <p className="text-xs text-[var(--ink-soft)]">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
              {log.note ? <Badge tone="accent">{log.note.title}</Badge> : null}
            </div>
            {log.metadata ? (
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-white px-3 py-2 text-xs text-[var(--ink-soft)]">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

// ⚠️ SENIOR NOTE: Audit metadata is rendered read-only and escaped through JSON
// stringification, which avoids turning admin observability into an XSS sink.
