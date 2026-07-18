"use client";

/**
 * Coordinates sidebar selection, note detail loading, draft editing, and note
 * mutations for the main application workspace.
 * Called by src/app/notes/page.tsx.
 * Calls note hooks in src/features/notes/hooks/use-notes.ts and UI subcomponents.
 * A junior engineer often lets one component grow into a god object; this file
 * should coordinate flows, not own transport or database logic.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, LogOut, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLogoutMutation } from "@/features/auth/hooks/use-logout-mutation";
import { CollaboratorPanel } from "@/features/notes/components/collaborator-panel";
import { NoteEditor } from "@/features/notes/components/note-editor";
import { NoteSidebar } from "@/features/notes/components/note-sidebar";
import { VersionHistoryPanel } from "@/features/notes/components/version-history-panel";
import {
  isConflictError,
  useCreateNoteMutation,
  useNoteDetailQuery,
  useNoteRevisionsQuery,
  useNotesQuery,
  useNoteStatusMutation,
  useSaveNoteMutation,
  useShareNoteMutation,
} from "@/features/notes/hooks/use-notes";
import { ApiClientError } from "@/lib/http/fetcher";
import type { AppSession } from "@/types/auth";

type ConflictDetails = {
  details?: {
    latestNote?: {
      title: string;
      currentBody: string;
      currentVersionNumber: number;
    };
  };
};

export function NotesWorkspace({ session }: { session: AppSession }) {
  const router = useRouter();
  const logoutMutation = useLogoutMutation();
  const notesQuery = useNotesQuery();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const effectiveSelectedNoteId = selectedNoteId ?? notesQuery.data?.[0]?.id ?? null;
  const noteQuery = useNoteDetailQuery(effectiveSelectedNoteId);
  const revisionsQuery = useNoteRevisionsQuery(effectiveSelectedNoteId);
  const createNoteMutation = useCreateNoteMutation();
  const saveNoteMutation = useSaveNoteMutation(effectiveSelectedNoteId);
  const shareNoteMutation = useShareNoteMutation(effectiveSelectedNoteId);
  const statusMutation = useNoteStatusMutation(effectiveSelectedNoteId);

  const [draft, setDraft] = useState<{
    noteId: string | null;
    versionNumber: number | null;
    title: string;
    body: string;
    changeSummary: string;
  }>({
    noteId: null,
    versionNumber: null,
    title: "",
    body: "",
    changeSummary: "",
  });
  const [message, setMessage] = useState<string | null>(null);

  const activeNote = noteQuery.data;
  const draftTitle =
    activeNote &&
    draft.noteId === activeNote.id &&
    draft.versionNumber === activeNote.currentVersionNumber
      ? draft.title
      : activeNote?.title ?? "";
  const draftBody =
    activeNote &&
    draft.noteId === activeNote.id &&
    draft.versionNumber === activeNote.currentVersionNumber
      ? draft.body
      : activeNote?.currentBody ?? "";
  const changeSummary =
    activeNote &&
    draft.noteId === activeNote.id &&
    draft.versionNumber === activeNote.currentVersionNumber
      ? draft.changeSummary
      : "";

  const setDraftField = (field: "title" | "body" | "changeSummary", value: string) => {
    if (!activeNote) {
      return;
    }

    setDraft((current) => ({
      noteId: activeNote.id,
      versionNumber: activeNote.currentVersionNumber,
      title:
        field === "title"
          ? value
          : current.noteId === activeNote.id &&
              current.versionNumber === activeNote.currentVersionNumber
            ? current.title
            : activeNote.title,
      body:
        field === "body"
          ? value
          : current.noteId === activeNote.id &&
              current.versionNumber === activeNote.currentVersionNumber
            ? current.body
            : activeNote.currentBody,
      changeSummary:
        field === "changeSummary"
          ? value
          : current.noteId === activeNote.id &&
              current.versionNumber === activeNote.currentVersionNumber
            ? current.changeSummary
            : "",
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[2.5rem] border border-[var(--border)] bg-[linear-gradient(135deg,rgba(242,114,76,0.14),rgba(255,255,255,0.92),rgba(20,68,88,0.08))] px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">
              Collaborative notes
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--ink-strong)]">
              Ship edits without losing history
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-soft)]">
              <Badge tone="accent">{session.user.role}</Badge>
              <span>{session.user.name}</span>
              <span>·</span>
              <span>{session.user.email}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {session.user.role === "APP_ADMIN" ? (
              <Button variant="secondary" className="gap-2" onClick={() => router.push("/admin")}>
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="gap-2"
              onClick={async () => {
                await logoutMutation.mutateAsync();
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
          <NoteSidebar
            notes={notesQuery.data ?? []}
            selectedNoteId={effectiveSelectedNoteId}
            onSelect={setSelectedNoteId}
            isCreating={createNoteMutation.isPending}
            onCreate={async () => {
              const created = await createNoteMutation.mutateAsync({
                title: "Untitled operational note",
                body: "Start writing here. Save with a change summary to build version history.",
              });
              setSelectedNoteId(created.id);
              setMessage("New note created.");
            }}
          />

          <div className="space-y-6">
            {noteQuery.data ? (
              <NoteEditor
                note={noteQuery.data}
                title={draftTitle}
                body={draftBody}
                changeSummary={changeSummary}
                onTitleChange={(value) => setDraftField("title", value)}
                onBodyChange={(value) => setDraftField("body", value)}
                onChangeSummaryChange={(value) => setDraftField("changeSummary", value)}
                isSaving={saveNoteMutation.isPending}
                isStatusUpdating={statusMutation.isPending}
                message={message}
                onSave={async () => {
                  try {
                    const saved = await saveNoteMutation.mutateAsync({
                      title: draftTitle,
                      body: draftBody,
                      baseVersionNumber: noteQuery.data.currentVersionNumber,
                      changeSummary,
                    });
                    setDraft({
                      noteId: saved.id,
                      versionNumber: saved.currentVersionNumber,
                      title: saved.title,
                      body: saved.currentBody,
                      changeSummary: "",
                    });
                    setMessage(`Saved version ${saved.currentVersionNumber}.`);
                  } catch (error) {
                    if (isConflictError(error) && error instanceof ApiClientError) {
                      const payload = error.payload as ConflictDetails;
                      const latestNote = payload.details?.latestNote;

                      if (latestNote) {
                        setDraft({
                          noteId: noteQuery.data.id,
                          versionNumber: latestNote.currentVersionNumber,
                          title: latestNote.title,
                          body: latestNote.currentBody,
                          changeSummary: "",
                        });
                      }

                      setMessage(
                        "A newer revision already exists. The editor reloaded the latest server version.",
                      );
                      return;
                    }

                    setMessage(error instanceof Error ? error.message : "Save failed.");
                  }
                }}
                onToggleStatus={async () => {
                  try {
                    const nextStatus =
                      noteQuery.data.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
                    const updated = await statusMutation.mutateAsync(nextStatus);
                    setMessage(`Note is now ${updated.status.toLowerCase()}.`);
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Status change failed.");
                  }
                }}
              />
            ) : (
              <div className="rounded-[2.3rem] border border-dashed border-[var(--border-strong)] bg-white/70 p-8 text-center">
                <BookOpenText className="mx-auto h-10 w-10 text-[var(--accent-strong)]" />
                <h2 className="mt-4 text-xl font-semibold text-[var(--ink-strong)]">
                  Choose a note to start editing
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
                  Notes use optimistic concurrency, so each save carries an explicit base
                  version and creates a revision record.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {noteQuery.data ? (
              <>
                <CollaboratorPanel
                  note={noteQuery.data}
                  isSharing={shareNoteMutation.isPending}
                  onShare={(input) => shareNoteMutation.mutateAsync(input)}
                />
                <VersionHistoryPanel
                  revisions={revisionsQuery.data}
                  isLoading={revisionsQuery.isLoading}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ⚠️ SENIOR NOTE: Conflict recovery updates the draft from server truth instead of
// blindly retrying, which prevents accidental overwrite loops during contention.
