# Request Lifecycle

**Correction (applies to every trace below):** the first two steps of each trace are listed in the wrong order. The route export is the `withAuth()` wrapper, or builds and calls it (`src/app/api/notes/route.ts:17`, `:26`; `src/app/api/notes/[noteId]/route.ts:21-23`), so the session is resolved first. Only then does the inner callback run `await request.json()` and `parseSchema()`. An anonymous caller with a malformed body gets `401`, not `422` or `500`. The original steps are kept as written. Read "parses ... with `createNoteSchema`" as happening at step 3, after `withAuth()`.

Request: Create a new note as a signed-in member
1. `src/app/api/notes/route.ts` — `POST` is invoked and parses the JSON body with `createNoteSchema`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the cookie into `session`.
3. `src/lib/validation/parse-schema.ts` — `parseSchema()` rejects malformed payloads before business logic.
4. `src/services/note-service.ts` — `createNote()` starts a transaction and decides that the creator should also be inserted as an `OWNER` collaborator.
5. `src/repositories/note-repository.ts` — `createNote()` creates the note, owner collaborator row, and initial `NoteRevision`.
6. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_CREATED` inside the same transaction.
7. Returns `201` with `{ note }`.

**Correction (step 4):** the service does not decide the `OWNER` row. It passes `ownerId: session.user.id` (`src/services/note-service.ts:156-163`), and the repository's nested write hard-codes `permission: "OWNER"` together with a v1 revision whose `changeSummary` is `"Initial version"` (`src/repositories/note-repository.ts:144-157`). The client never sends an owner id. `createNoteSchema` only has `title` and `body` (`src/lib/validation/note-schemas.ts:14-17`), so an extra `ownerId` field in the body is dropped by Zod's default object parsing.

Request: Save edits to an existing note with optimistic concurrency
1. `src/app/api/notes/[noteId]/route.ts` — `PUT` parses `noteId` params and `updateNoteSchema`, including `baseVersionNumber`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
3. `src/lib/validation/parse-schema.ts` — `parseSchema()` validates both params and body.
4. `src/services/note-service.ts` — `updateNote()` loads the note, calls `getNoteAccessLevel()`, and runs `assertCanEditNote()`.
5. `src/repositories/note-repository.ts` — `findAccessibleById()` scopes the fetch through `buildAccessibleNoteWhere()`.
6. `src/repositories/note-repository.ts` — `updateNoteWithRevisionIfVersionMatches()` performs the compare-and-swap update on `currentVersionNumber` and inserts the next `NoteRevision`.
7. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_UPDATED`.
8. Returns `200` with `{ note }`.

**Addition (what happens between steps 5 and 8):**

- Before the write, the service compares `currentNote.currentVersionNumber !== input.baseVersionNumber` in memory (`src/services/note-service.ts:244`). A mismatch goes to the stale-save path below and never opens a transaction.
- Step 6 runs inside `deps.prisma.$transaction(async (db) => ...)` (`note-service.ts:263`). The conditional update is `note.updateMany({ where: { id, currentVersionNumber: expected, status: "ACTIVE" } })` (`src/repositories/note-repository.ts:179-192`). Zero rows updated means `false` is returned and no revision is inserted (`:194-196`).
- Step 7 also runs on the transaction client (`note-service.ts:280-290`), with `metadata: { versionNumber: base + 1 }`.
- Then, still inside the callback, the service re-reads the note with `findAccessibleById(noteId, userId, role)` (`note-service.ts:292`). That call does not receive `db`, so it runs on the global client, outside the transaction. It is expected to return the note as it was **before** this save (finding F2 in [auth-and-permissions.md](auth-and-permissions.md#findings)).
- If the transaction returned `null` (lost race), the service re-reads once more and throws `409 VERSION_CONFLICT` with that note in `details.latestNote` (`:295-311`). No `NOTE_CONFLICT_REJECTED` row is written on this path (F3, run).

Request: Share a note with another user as the owner
1. `src/app/api/notes/[noteId]/share/route.ts` — `POST` parses `noteId` params and `shareNoteSchema`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
3. `src/services/note-service.ts` — `upsertCollaborator()` loads the note, computes access with `getNoteAccessLevel()`, and runs `assertCanManageSharing()`.
4. `src/repositories/user-repository.ts` — `findByEmail()` resolves the collaborator identity.
5. `src/repositories/note-repository.ts` — `upsertCollaborator()` inserts or updates the `NoteCollaborator` row.
6. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_COLLABORATOR_UPSERTED`.
7. Returns `200` with `{ note }`.

**Addition (guards between steps 4 and 5):** an unknown email gives `404 USER_NOT_FOUND` (`src/services/note-service.ts:342-345`). Changing the `Note.ownerId` user to anything but `OWNER` gives `422 INVALID_PERMISSION_CHANGE` (`:347-349`). Steps 5 and 6 share one transaction (`:351-373`). The response is built from a fresh `findAccessibleById()` after the transaction commits (`:375-385`), so unlike the save path it does see the new row. There is no status check, so an archived note can still be shared (check S6, run).

Request: Reject a stale note save after another collaborator already wrote a newer version
1. `src/app/api/notes/[noteId]/route.ts` — `PUT` parses the body and forwards the request.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the caller.
3. `src/services/note-service.ts` — `updateNote()` loads the current note through `findAccessibleById()`.
4. `src/services/note-service.ts` — `updateNote()` compares `input.baseVersionNumber` to `currentNote.currentVersionNumber`.
5. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_CONFLICT_REJECTED`.
6. Returns `409` with `error: "VERSION_CONFLICT"` and `details.latestNote`.

Between steps 3 and 4 the service also runs `assertCanEditNote()` (`note-service.ts:242`). A viewer, or anyone saving to an archived note, gets `403` or `409 NOTE_ARCHIVED` before the version comparison happens. The `details.latestNote` object has seven fields: `id`, `title`, `currentBody`, `currentVersionNumber`, `updatedAt`, `lastEditedAt`, `status` (`buildConflictDetails()`, `note-service.ts:127-139`). Check S1 (run) confirmed the status, the code, `details.latestNote.currentVersionNumber`, and the single audit write.

Request: Reject a member calling the admin audit endpoint
1. `src/app/api/admin/audit-logs/route.ts` — `GET` composes `withAuth(withRole(["APP_ADMIN"], ...))`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
3. `src/lib/middleware/with-role.ts` — `withRole()` checks `session.user.role`.
4. `src/services/audit-log-service.ts` is never called because the request is rejected here.
5. Returns `403` with `error: "FORBIDDEN"`.

This trace is in the correct order: here `withAuth` and `withRole` really are the outermost layers, and there is no body to parse.

## Additional requests

The original document covered five requests. These are the remaining paths, each traced from the code.

Request: Sign in
1. `src/app/api/auth/login/route.ts` — `POST` (no wrapper) runs `parseSchema(loginSchema, await request.json())` (`:19`). Invalid JSON gives `500` (F1). A bad shape (not an email, or a password outside 8-128 characters, `src/lib/validation/auth-schemas.ts:9-12`) gives `422`.
2. `src/services/auth-service.ts` — `login()` calls `findByEmail()`. No user, or a failed `verifyPassword()`, writes `LOGIN_FAILED` and throws `401 INVALID_CREDENTIALS` (`:30-40`).
3. A 64-hex-character token is generated and its hash stored with a 14-day expiry (`:42-49`), then `LOGIN_SUCCEEDED` is written (`:51-55`).
4. The route builds `200 { session }` and calls `attachSessionCookie()` with the raw token (`login/route.ts:21-23`). The raw token only ever exists in this response's `Set-Cookie` header.

Note that the minimum password length of 8 also applies at login. A user whose real password were shorter could never sign in, but no code path can create such a user, so this only matters for manual inserts.

Request: Sign out
1. `src/app/api/auth/logout/route.ts` — `POST` is `withAuth(...)`. No live session gives `401`, and the cookie is not cleared (F9).
2. The handler re-reads the raw cookie (`:19`) and, if present, calls `authService.logout({ token, actorId })`. That deletes by token hash with `deleteMany` (no error if already gone) and writes `LOGOUT` (`src/services/auth-service.ts:73-79`).
3. Returns `200 { success: true }` with the cookie overwritten to empty and expired (`src/lib/auth/session.ts:92-102`).

Request: Session introspection
1. `src/app/api/auth/session/route.ts` — `GET` calls `resolveRequestSession(request)` and returns `200 { session }`, where `session` is `null` when anonymous. It never returns `401`.
2. Side effect: a valid session gets its `lastSeenAt` updated (`session.ts:57`).
3. No client code calls this route. The header comment says "Called by React Query session hooks" (`:3`), but no such hook exists under `src/features`. Pages get the session server-side through `getServerAppSession()` instead.

Request: List notes
1. `GET /api/notes`, `withAuth`, then `noteService.listNotes(session)` (`src/services/note-service.ts:142-149`).
2. `listAccessibleForUser()` uses the scoped `where`, sorts `status asc, updatedAt desc`, and includes only the *caller's own* collaborator row (`src/repositories/note-repository.ts:78-101`).
3. `toSummaryDto()` returns a 140-character excerpt and `currentUserPermission = collaborators[0]?.permission ?? (note.ownerId ? "OWNER" : "VIEWER")` (`note-service.ts:85-86`). For members, `collaborators[0]` always exists, because the scope requires it. For an admin without a row, the fallback applies. `ownerId` is a required column and always truthy, so the admin always sees `OWNER` and the `"VIEWER"` branch can never run (check S9, run).
4. No pagination. Every visible note is returned.

Request: Read one note
1. `GET /api/notes/[noteId]`, `withAuth`, then `parseSchema(noteIdParamsSchema, await context.params)`. `noteId` only needs to be a non-empty string (`note-schemas.ts:10-12`).
2. `getNoteDetail()` calls `findAccessibleById()`. `null` gives `404 NOTE_NOT_FOUND` (`note-service.ts:180-192`).
3. `toDetailDto()` computes `access` with `getNoteAccessLevel()` and returns the note, owner, `access` flags, all collaborators (with their emails and system roles), and the latest 8 revisions (`note-repository.ts:37-75`, `note-service.ts:89-125`).

Every collaborator, including a `VIEWER`, receives every other collaborator's email address and system role (`note-repository.ts:50-56`). That is a deliberate sharing UX, but it is worth knowing if user emails are sensitive.

Request: List revisions
1. `GET /api/notes/[noteId]/revisions`, `withAuth`, params parse.
2. `listRevisions()` first calls `findAccessibleById()` (404 if not visible), then `listAccessibleRevisions()`, which applies the same scope again through the `note` relation (`note-service.ts:194-212`, `note-repository.ts:110-129`).
3. Returns every revision, newest first, with full bodies and editor name and email. Unbounded (F12).

Request: Archive or restore
1. `PATCH /api/notes/[noteId]/status`, `withAuth`, params plus `noteStatusSchema` (`status` must be `ACTIVE` or `ARCHIVED`).
2. `updateStatus()` loads the note (404), then `assertCanChangeStatus()` (403 for editors and viewers), then rejects `nextStatus === note.status` with `409 INVALID_STATUS_TRANSITION` (`note-service.ts:393-419`).
3. In one transaction: `note.update({ where: { id }, data: { status, updatedAt } })` and `NOTE_STATUS_CHANGED { from, to }` (`:421-435`). The update has no status condition (F5).
4. Re-reads after commit and returns `200 { note }`.

Request: Admin reads the audit log
1. `GET /api/admin/audit-logs`, `withAuth`, `withRole(["APP_ADMIN"])`.
2. `auditLogService.listRecent()` gets the latest 40 rows with actor `{ id, name, email }` and note `{ id, title }`, and maps `createdAt` to an ISO string (`src/services/audit-log-service.ts:11-33`).
3. Returns `200 { logs }`. No filtering, paging, or date range.

## Status code catalogue

Every status the API can return, and where it comes from.

| Status | `error` code | Produced by |
| --- | --- | --- |
| 200 | (none) | `ok()` (`src/lib/http/api-response.ts:11`) |
| 201 | (none) | `created()` (`api-response.ts:13`), only `POST /api/notes` |
| 401 | `UNAUTHENTICATED` | `withAuth` (`src/lib/middleware/with-auth.ts:33-39`) |
| 401 | `INVALID_CREDENTIALS` | `auth-service.ts:39` |
| 403 | `FORBIDDEN` | `withRole` (`with-role.ts:25-31`); `assertCanEditNote`, `assertCanManageSharing`, `assertCanChangeStatus` (`permissions.ts:78`, `:84-88`, `:96`) |
| 404 | `NOTE_NOT_FOUND` | `note-service.ts:188`, `:202`, `:231`, `:303`, `:329`, `:382`, `:400`, `:444`; `permissions.ts:54` |
| 404 | `USER_NOT_FOUND` | `note-service.ts:344` |
| 409 | `VERSION_CONFLICT` | `note-service.ts:255-260`, `:306-311` |
| 409 | `NOTE_ARCHIVED` | `permissions.ts:74` |
| 409 | `INVALID_STATUS_TRANSITION` | `note-service.ts:414-418` |
| 422 | `VALIDATION_ERROR` | `parse-schema.ts:14-19`, with `details` = Zod's `flatten()` output |
| 422 | `INVALID_PERMISSION_CHANGE` | `note-service.ts:348` |
| 500 | `INTERNAL_SERVER_ERROR` | `api-response.ts:27-33`: any non-`AppError`, including invalid JSON (F1) and Prisma errors such as a unique-constraint violation |

There is no `400` anywhere in the codebase. Shape errors are `422`, and unparseable bodies are `500`.

`flatten()` (`parse-schema.ts:18`) is deprecated in Zod 4 in favor of `z.flattenError()`. It still exists in Zod 4, so this works today. It was not executed here because Zod is not installed in the checkout.

## Debugging scenarios

| Symptom | Likely cause | Where to look |
| --- | --- | --- |
| `curl -X POST /api/notes -d 'title=x'` returns 500 | Body is not JSON; `request.json()` throws (F1) | `src/app/api/notes/route.ts:28`, `api-response.ts:27` |
| Same curl with a valid JSON body returns 401 | No cookie. Copy the `collab_notes_session` cookie from the browser, or log in with `curl -c` first | `with-auth.ts:31-40` |
| Login returns 200 but `/notes` bounces to `/login` | Production build over HTTP, so the `secure` cookie is dropped | `session.ts:86` |
| Everyone was logged out after a deploy | `SESSION_SECRET` changed, so stored hashes no longer match | `session-token.ts:13-14` |
| "Saved version 3." but the badge then shows version 4 | The save response is the pre-commit read; the later refetch corrects it (F2) | `note-service.ts:292`, `notes-workspace.tsx:209` |
| Saving an archived-then-restored note says "newer revision exists" | Note was archived during your save (F4), or someone else saved | `note-repository.ts:183`, `note-service.ts:295-311` |
| Admin audit page shows fewer conflicts than users report | Race-path conflicts are not audited (F3) | `note-service.ts:295-311` |
| Share returns 404 `USER_NOT_FOUND` for a real colleague | There is no sign-up; the user must exist in `User` | `user-repository.ts:10-14`, `prisma/seed.ts` |
| Share returns 422 `VALIDATION_ERROR` | `permission` not one of `OWNER`/`EDITOR`/`VIEWER`, or not a valid email | `note-schemas.ts:26-29` |
| Save returns 422 with `fieldErrors.title` | Title shorter than 3 or longer than 120 characters after trimming | `note-schemas.ts:20` |
| Prisma error "Environment variable not found: DATABASE_URL" even though `env.ts` has a default | The default is not wired into Prisma (F10) | `prisma.ts:18`, `schema.prisma:17` |
| Removed user still sees the note | You can only downgrade to `VIEWER`; there is no remove (F7) | `share/route.ts` |
| Admin sees a note in the list but is not in its collaborator panel | By design: admin access comes from the role, not a row | `note-repository.ts:23-25` |
