"use client";

import { Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { NoteRevisionDto } from "@/types/note";

export function VersionHistoryPanel({
  revisions,
  isLoading,
}: {
  revisions: NoteRevisionDto[] | undefined;
  isLoading: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border)] bg-white p-5">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-[var(--accent-strong)]" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Version history
        </h3>
      </div>
      <div className="mt-4 space-y-3">
        {isLoading ? <p className="text-sm text-[var(--ink-soft)]">Loading history...</p> : null}
        {revisions?.map((revision) => (
          <article key={revision.id} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-strong)]">
                  Version {revision.versionNumber}
                </p>
                <p className="text-xs text-[var(--ink-soft)]">
                  {revision.editedBy.name} · {new Date(revision.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge tone="neutral">{revision.changeSummary ?? "No summary"}</Badge>
            </div>
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--ink-soft)]">
              {revision.bodySnapshot}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
