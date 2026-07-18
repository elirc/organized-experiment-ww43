"use client";

/**
 * Renders the editable note surface and explicit save/archive actions.
 * Called by src/features/notes/components/notes-workspace.tsx.
 * Calls hooks from src/features/notes/hooks/use-notes.ts.
 * A junior engineer often binds text inputs directly to server state, which
 * makes drafts impossible to manage once real mutations are involved.
 */
import { Archive, RotateCcw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Textarea } from "@/components/ui/field";
import type { NoteDetail } from "@/types/note";

export function NoteEditor({
  note,
  title,
  body,
  changeSummary,
  onTitleChange,
  onBodyChange,
  onChangeSummaryChange,
  onSave,
  onToggleStatus,
  isSaving,
  isStatusUpdating,
  message,
}: {
  note: NoteDetail;
  title: string;
  body: string;
  changeSummary: string;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onChangeSummaryChange: (value: string) => void;
  onSave: () => void;
  onToggleStatus: () => void;
  isSaving: boolean;
  isStatusUpdating: boolean;
  message: string | null;
}) {
  const isDirty = title !== note.title || body !== note.currentBody || changeSummary.length > 0;

  return (
    <section className="rounded-[2.3rem] border border-[var(--border)] bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.1)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{note.access.permission}</Badge>
            <Badge tone={note.status === "ARCHIVED" ? "danger" : "neutral"}>{note.status}</Badge>
            <Badge>Version {note.currentVersionNumber}</Badge>
          </div>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Owned by {note.owner.name}. Last edited {new Date(note.lastEditedAt).toLocaleString()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {note.access.canArchive ? (
            <Button
              variant="secondary"
              onClick={onToggleStatus}
              disabled={isStatusUpdating}
              className="gap-2"
            >
              {note.status === "ARCHIVED" ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Restore
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" />
                  Archive
                </>
              )}
            </Button>
          ) : null}
          <Button
            onClick={onSave}
            disabled={!note.access.canEdit || !isDirty || isSaving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save revision"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <div>
          <FieldLabel htmlFor="note-title">Title</FieldLabel>
          <Input
            id="note-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={!note.access.canEdit}
          />
        </div>
        <div>
          <FieldLabel htmlFor="note-body">Body</FieldLabel>
          <Textarea
            id="note-body"
            rows={15}
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            disabled={!note.access.canEdit}
          />
        </div>
        <div>
          <FieldLabel htmlFor="change-summary">Change summary</FieldLabel>
          <Input
            id="change-summary"
            placeholder="What changed in this revision?"
            value={changeSummary}
            onChange={(event) => onChangeSummaryChange(event.target.value)}
            disabled={!note.access.canEdit}
          />
        </div>
      </div>

      {message ? <p className="mt-4 text-sm font-medium text-[var(--ink-soft)]">{message}</p> : null}
    </section>
  );
}

// ⚠️ SENIOR NOTE: Draft state stays separate from the query cache so the editor
// can manage unsaved changes without mutating server truth prematurely.
