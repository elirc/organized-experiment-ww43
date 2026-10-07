# Flow Traces

**Correction (step order in the server half of every flow):** where a flow lists the route parsing the body *before* `withAuth()` (for example steps 4-6 of "Save a note revision successfully"), the real order is the reverse. `withAuth()` resolves the session first, and only its inner callback calls `await request.json()` and `parseSchema()` (`src/lib/middleware/with-auth.ts:30-42`, `src/app/api/notes/[noteId]/route.ts:33-44`). The steps below are kept as originally written; the flows added at the end of this file use the real order.

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

## Notes on the flows above

- **Create (step 9):** besides invalidating the list, `useCreateNoteMutation` seeds the detail cache with the returned note (`src/features/notes/hooks/use-notes.ts:57-60`), and the workspace selects it (`src/features/notes/components/notes-workspace.tsx:176`). The new note always gets the hard-coded title "Untitled operational note" and a placeholder body (`notes-workspace.tsx:172-175`). There is no create form.
- **Save (step 11):** the hook first writes the response into `["notes", id]` (`use-notes.ts:84`) and then invalidates `["notes"]` and `["notes", id, "revisions"]` (`:85-88`). React Query matches query keys by prefix, so invalidating `["notes"]` also refetches the detail and the revisions. The revisions invalidation is redundant but harmless. The refetch matters, because the response itself is expected to be the pre-save state (finding F2 in [../architecture/auth-and-permissions.md](../architecture/auth-and-permissions.md#findings)).
- **Stale save (step 8):** the reset only happens when `isConflictError(error) && error instanceof ApiClientError` (`notes-workspace.tsx:211`), and `isConflictError` is just `status === 409` (`use-notes.ts:135-136`). `NOTE_ARCHIVED` and `INVALID_STATUS_TRANSITION` are also `409`. A save rejected as `NOTE_ARCHIVED` therefore enters the conflict branch too. It finds no `details.latestNote` (that error has no details), skips the draft reset, and still shows "A newer revision already exists..." (`:225-227`). The archived editor disables the Save button (`src/features/notes/components/note-editor.tsx:82`), so this only happens if a note is archived after the page loaded.
- **Stale save, draft reset:** the reset sets `draft.versionNumber` to `latestNote.currentVersionNumber` (`notes-workspace.tsx:216-222`). The draft is shown only while `draft.versionNumber === activeNote.currentVersionNumber` (`:74-91`). The detail query still holds the old version until it is refetched, so the reloaded text may not appear until the next detail fetch. Nothing in the conflict branch invalidates the query. The 15-second `staleTime` (`src/components/providers/app-providers.tsx:20`) and `refetchOnWindowFocus: false` (`:21`) mean the user may keep seeing their own stale draft for a while. Traced by reading; the UI was not run.
- **Share (step 8):** "the notes query cache is updated" means `setQueryData(["notes", id], note)` plus invalidation of `["notes"]` (`use-notes.ts:107-110`).
- **Archive (step 6):** the write is unconditional, so a double-click that sends two requests can produce two `NOTE_STATUS_CHANGED` rows (finding F5). The button is disabled while `statusMutation.isPending` (`note-editor.tsx:64`), which makes this unlikely from one browser.

## Flow: Sign in from the login page

1. `src/app/login/page.tsx:13-17` runs on the server: `getServerAppSession()` reads the cookie. A valid session redirects to `/notes` before the form renders.
2. `src/features/auth/components/login-form.tsx:26-27` pre-fills `owner@notes.local` / `OwnerPass123!`.
3. Submit calls `loginMutation.mutateAsync({ email, password })` (`:36`), which is `apiFetch("/api/auth/login", { method: "POST", body })` (`src/features/auth/hooks/use-login-mutation.ts:15-22`).
4. `apiFetch` always sends `Content-Type: application/json` and `cache: "no-store"` (`src/lib/http/fetcher.ts:22-29`).
5. Server: `POST /api/auth/login`, then `parseSchema(loginSchema, ...)`, then `authService.login()`, then `attachSessionCookie()` (see [../architecture/request-lifecycle.md](../architecture/request-lifecycle.md#additional-requests)).
6. On success the form calls `router.push("/notes")` and `router.refresh()` (`login-form.tsx:37-38`). On failure, `ApiClientError.message` is the server's `message`, for example "Invalid email or password.", and it renders under the form (`:77-79`).

## Flow: Open the workspace (first paint)

1. `src/app/notes/page.tsx:13-19` calls `getServerAppSession()`. With no session it redirects to `/login`. Otherwise it renders `<NotesWorkspace session={session} />`, so the client receives the session as a prop and never calls `/api/auth/session`.
2. `useNotesQuery()` fetches `GET /api/notes` (`use-notes.ts:21-26`).
3. With nothing selected, `effectiveSelectedNoteId` becomes the first note in the list (`notes-workspace.tsx:50`). Because the server sorts ACTIVE before ARCHIVED and then newest first (`src/repositories/note-repository.ts:81`), that is the most recently updated active note.
4. `useNoteDetailQuery(id)` and `useNoteRevisionsQuery(id)` fire in parallel (`notes-workspace.tsx:51-52`). Both are disabled while `id` is null (`use-notes.ts:33`, `:44`).
5. The editor, collaborator panel, and history panel render from `noteQuery.data` and `revisionsQuery.data`. The Admin button shows only when `session.user.role === "APP_ADMIN"` (`notes-workspace.tsx:144`). That is a UI affordance; the API enforces the role separately.

Three server round trips (list, detail, revisions) plus the page render, each with its own session lookup and `lastSeenAt` write for the API calls.

## Flow: Lose a race to another editor (server side)

This is the path the original "stale save" flow does not cover: both editors loaded version 3, and both press Save at nearly the same time.

1. Both `PUT` requests pass `withAuth()` and `parseSchema()` with `baseVersionNumber: 3`.
2. Both `updateNote()` calls load the note at version 3, so both pass the in-memory check (`src/services/note-service.ts:244`).
3. Both open a transaction and run `updateMany({ where: { id, currentVersionNumber: 3, status: "ACTIVE" } })` (`src/repositories/note-repository.ts:179-192`). PostgreSQL row locking lets only one of them match. The other waits for the first to commit, re-evaluates its `WHERE` against the new row (now version 4), and matches 0 rows.
4. The winner inserts revision 4 and `NOTE_UPDATED`, then commits.
5. The loser's repository call returns `false` (`:194-196`), its callback returns `null`, and its transaction commits with no changes.
6. The loser's service re-reads the note (now version 4) and throws `409 VERSION_CONFLICT` with `details.latestNote` (`note-service.ts:295-311`). **No `NOTE_CONFLICT_REJECTED` row is written** (F3; the service half of this was run as check S2, the PostgreSQL locking half is by reading).
7. The loser's browser takes the same conflict branch as the original stale-save flow.

## Flow: Sign out

1. `src/features/notes/components/notes-workspace.tsx:150-160`: the Sign out button awaits `logoutMutation.mutateAsync()`, then `router.push("/login")` and `router.refresh()`.
2. `useLogoutMutation` posts to `/api/auth/logout` and on success calls `queryClient.clear()` (`src/features/auth/hooks/use-logout-mutation.ts:10-17`), so the next user on the same tab does not see cached notes.
3. Server: `withAuth()`, then delete the session row by token hash, write `LOGOUT`, and expire the cookie (`src/app/api/auth/logout/route.ts:17-34`).
4. If the server returns `401` because the session already expired, `mutateAsync` rejects. The click handler has no `try`/`catch` (`notes-workspace.tsx:153-157`), so `router.push("/login")` never runs and the user stays on the page with an unhandled promise rejection in the console. Traced by reading.

## Flow: Admin opens the audit log

1. `src/app/admin/page.tsx:15-23`: anonymous goes to `/login`, a non-admin goes to `/notes`.
2. `AuditLogView` calls `useAuditLogsQuery()`, which runs `GET /api/admin/audit-logs` (`src/features/admin/hooks/use-audit-logs.ts:8-14`).
3. Server: `withAuth()`, `withRole(["APP_ADMIN"])`, then `auditLogService.listRecent()` with the latest 40 rows.
4. Each row renders `actor?.name ?? "System"`, the action, the local time, a note-title badge, and `JSON.stringify(metadata)` inside a `<pre>` (`src/features/admin/components/audit-log-view.tsx:32-54`). React escapes the string, so metadata cannot inject HTML.
5. If the query fails, nothing is shown: the component renders a loading line and the data list but no error state (`audit-log-view.tsx:31-54`).
