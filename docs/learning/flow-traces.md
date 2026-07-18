# Flow Traces

## Flow: Create note from the workspace
1. `src/features/notes/components/notes-workspace.tsx` — the `onCreate` callback calls `createNoteMutation.mutateAsync()`.
2. `src/features/notes/hooks/use-notes.ts` — `useCreateNoteMutation()` fires `POST /api/notes`.
3. `src/app/api/notes/route.ts` — `POST` route handler runs.
4. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the request session.
5. `src/lib/validation/parse-schema.ts` — `parseSchema(createNoteSchema, await request.json())`.
6. `src/services/note-service.ts` — `createNote()` starts a transaction and decides the creator is also an `OWNER` collaborator.
7. `src/repositories/note-repository.ts` — `createNote()` writes the note, owner collaborator row, and version `1` revision.
8. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_CREATED`.
9. Returns `{ note }`, and `src/features/notes/hooks/use-notes.ts` invalidates the note list query.

## Flow: Save a note revision successfully
1. `src/features/notes/components/note-editor.tsx` — clicking “Save revision” calls `onSave()`.
2. `src/features/notes/components/notes-workspace.tsx` — `onSave` calls `saveNoteMutation.mutateAsync()` with `baseVersionNumber`.
3. `src/features/notes/hooks/use-notes.ts` — `useSaveNoteMutation()` fires `PUT /api/notes/[noteId]`.
4. `src/app/api/notes/[noteId]/route.ts` — `PUT` parses params and request body.
5. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the user session.
6. `src/lib/validation/parse-schema.ts` — `parseSchema(updateNoteSchema, body)` validates the concurrency token.
7. `src/services/note-service.ts` — `updateNote()` loads the note and calls `assertCanEditNote()`.
8. `src/repositories/note-repository.ts` — `findAccessibleById()` loads the note through `buildAccessibleNoteWhere()`.
9. `src/repositories/note-repository.ts` — `updateNoteWithRevisionIfVersionMatches()` performs the compare-and-swap update and inserts the next revision.
10. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_UPDATED`.
11. Returns `{ note }`, and `src/features/notes/hooks/use-notes.ts` refreshes note detail, note list, and revision history.

## Flow: Reject a stale save with version conflict
1. `src/features/notes/components/notes-workspace.tsx` — `onSave` still calls `saveNoteMutation.mutateAsync()`, but the request contains an outdated `baseVersionNumber`.
2. `src/features/notes/hooks/use-notes.ts` — `useSaveNoteMutation()` fires `PUT /api/notes/[noteId]`.
3. `src/app/api/notes/[noteId]/route.ts` — `PUT` forwards the validated request.
4. `src/services/note-service.ts` — `updateNote()` compares `input.baseVersionNumber` to `currentNote.currentVersionNumber`.
5. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_CONFLICT_REJECTED`.
6. `src/services/note-service.ts` — `updateNote()` throws `appError(..., "VERSION_CONFLICT", buildConflictDetails(currentNote))`.
7. `src/lib/http/api-response.ts` — `apiError()` converts the `AppError` into a `409` JSON response.
8. `src/features/notes/components/notes-workspace.tsx` — the `catch` branch sees `ApiClientError`, reads `payload.details.latestNote`, and resets the draft to the latest server state.

## Flow: Reject a member on the admin audit endpoint
1. `src/features/admin/hooks/use-audit-logs.ts` — `useAuditLogsQuery()` requests `GET /api/admin/audit-logs`.
2. `src/app/api/admin/audit-logs/route.ts` — `GET` is composed through `withAuth(withRole(["APP_ADMIN"], ...))`.
3. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
4. `src/lib/middleware/with-role.ts` — `withRole()` checks `session.user.role`.
5. `src/services/audit-log-service.ts` — `listRecent()` is not called because the route returns early.
6. Returns `403` with `error: "FORBIDDEN"`.

## Flow: Share a note with a collaborator
1. `src/features/notes/components/collaborator-panel.tsx` — the share form submits `onShare({ email, permission })`.
2. `src/features/notes/components/notes-workspace.tsx` — `onShare` calls `shareNoteMutation.mutateAsync(input)`.
3. `src/features/notes/hooks/use-notes.ts` — `useShareNoteMutation()` fires `POST /api/notes/[noteId]/share`.
4. `src/app/api/notes/[noteId]/share/route.ts` — parses params and `shareNoteSchema`.
5. `src/services/note-service.ts` — `upsertCollaborator()` loads the note, calls `assertCanManageSharing()`, and resolves the target user with `findByEmail()`.
6. `src/repositories/note-repository.ts` — `upsertCollaborator()` inserts or updates the collaborator row.
7. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_COLLABORATOR_UPSERTED`.
8. Returns `{ note }`, and the notes query cache is updated from the server response.

## Flow: Archive a note
1. `src/features/notes/components/note-editor.tsx` — clicking the archive or restore button calls `onToggleStatus()`.
2. `src/features/notes/components/notes-workspace.tsx` — `onToggleStatus` computes the next status and calls `statusMutation.mutateAsync(nextStatus)`.
3. `src/features/notes/hooks/use-notes.ts` — `useNoteStatusMutation()` fires `PATCH /api/notes/[noteId]/status`.
4. `src/app/api/notes/[noteId]/status/route.ts` — parses the body with `noteStatusSchema`.
5. `src/services/note-service.ts` — `updateStatus()` loads the note, calls `assertCanChangeStatus()`, and rejects same-state transitions.
6. `src/repositories/note-repository.ts` — `updateStatus()` writes the new `Note.status`.
7. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_STATUS_CHANGED`.
8. Returns `{ note }`, and the notes list query is invalidated so archived state is visible in the sidebar.
