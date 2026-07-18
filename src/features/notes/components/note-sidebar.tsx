"use client";

import { Plus, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NoteSummary } from "@/types/note";

export function NoteSidebar({
  notes,
  selectedNoteId,
  onSelect,
  onCreate,
  isCreating,
}: {
  notes: NoteSummary[];
  selectedNoteId: string | null;
  onSelect: (noteId: string) => void;
  onCreate: () => void;
  isCreating: boolean;
}) {
  return (
    <aside className="rounded-[2rem] border border-[var(--border)] bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink-soft)]">
            Notes
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--ink-strong)]">
            Your workspace
          </h2>
        </div>
        <Button onClick={onCreate} disabled={isCreating} className="gap-2 px-3">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {notes.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onSelect(note.id)}
            className={`w-full rounded-[1.7rem] border p-4 text-left transition ${
              selectedNoteId === note.id
                ? "border-[var(--accent-strong)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-strong)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink-strong)]">{note.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ink-soft)]">
                  {note.excerpt}
                </p>
              </div>
              <Badge tone={note.status === "ARCHIVED" ? "danger" : "accent"}>{note.status}</Badge>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
              <span>v{note.currentVersionNumber}</span>
              <span>{note.currentUserPermission}</span>
            </div>
          </button>
        ))}

        {!notes.length ? (
          <div className="rounded-[1.7rem] border border-dashed border-[var(--border-strong)] p-6 text-sm text-[var(--ink-soft)]">
            <div className="flex items-center gap-2 font-semibold text-[var(--ink-strong)]">
              <ShieldCheck className="h-4 w-4" />
              Empty workspace
            </div>
            <p className="mt-2">Create your first note to exercise version history and sharing.</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
