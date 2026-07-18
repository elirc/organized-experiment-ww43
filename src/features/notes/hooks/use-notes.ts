"use client";

/**
 * React Query hooks for notes, revisions, sharing, and status changes.
 * Called by note workspace components.
 * Calls the note REST API routes through src/lib/http/fetcher.ts.
 * A junior engineer often scatters query keys and invalidation logic across
 * components, which causes stale UI after mutations.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiClientError, apiFetch } from "@/lib/http/fetcher";
import type { NoteDetail, NoteRevisionDto, NoteSummary } from "@/types/note";

const noteKeys = {
  all: ["notes"] as const,
  detail: (noteId: string) => ["notes", noteId] as const,
  revisions: (noteId: string) => ["notes", noteId, "revisions"] as const,
};

export function useNotesQuery() {
  return useQuery({
    queryKey: noteKeys.all,
    queryFn: () => apiFetch<{ notes: NoteSummary[] }>("/api/notes").then((data) => data.notes),
  });
}

export function useNoteDetailQuery(noteId: string | null) {
  return useQuery({
    queryKey: noteId ? noteKeys.detail(noteId) : ["notes", "empty"],
    queryFn: () =>
      apiFetch<{ note: NoteDetail }>(`/api/notes/${noteId}`).then((data) => data.note),
    enabled: Boolean(noteId),
  });
}

export function useNoteRevisionsQuery(noteId: string | null) {
  return useQuery({
    queryKey: noteId ? noteKeys.revisions(noteId) : ["notes", "empty", "revisions"],
    queryFn: () =>
      apiFetch<{ revisions: NoteRevisionDto[] }>(`/api/notes/${noteId}/revisions`).then(
        (data) => data.revisions,
      ),
    enabled: Boolean(noteId),
  });
}

export function useCreateNoteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { title: string; body: string }) =>
      apiFetch<{ note: NoteDetail }>("/api/notes", {
        method: "POST",
        body: JSON.stringify(input),
      }).then((data) => data.note),
    onSuccess: async (note) => {
      await queryClient.invalidateQueries({ queryKey: noteKeys.all });
      queryClient.setQueryData(noteKeys.detail(note.id), note);
    },
  });
}

export function useSaveNoteMutation(noteId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      title: string;
      body: string;
      baseVersionNumber: number;
      changeSummary?: string;
    }) => {
      if (!noteId) {
        throw new Error("Choose a note before saving.");
      }

      return apiFetch<{ note: NoteDetail }>(`/api/notes/${noteId}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }).then((data) => data.note);
    },
    onSuccess: async (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: noteKeys.all }),
        queryClient.invalidateQueries({ queryKey: noteKeys.revisions(note.id) }),
      ]);
    },
  });
}

export function useShareNoteMutation(noteId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; permission: "OWNER" | "EDITOR" | "VIEWER" }) => {
      if (!noteId) {
        throw new Error("Choose a note before sharing.");
      }

      return apiFetch<{ note: NoteDetail }>(`/api/notes/${noteId}/share`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((data) => data.note);
    },
    onSuccess: async (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      await queryClient.invalidateQueries({ queryKey: noteKeys.all });
    },
  });
}

export function useNoteStatusMutation(noteId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: "ACTIVE" | "ARCHIVED") => {
      if (!noteId) {
        throw new Error("Choose a note before changing status.");
      }

      return apiFetch<{ note: NoteDetail }>(`/api/notes/${noteId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }).then((data) => data.note);
    },
    onSuccess: async (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      await queryClient.invalidateQueries({ queryKey: noteKeys.all });
    },
  });
}

export const isConflictError = (error: unknown) =>
  error instanceof ApiClientError && error.status === 409;

// ⚠️ SENIOR NOTE: Mutation success writes the authoritative server response back
// into the cache so the editor does not depend on guessed optimistic state.
