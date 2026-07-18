# Request Lifecycle

Request: Create a new note as a signed-in member
1. `src/app/api/notes/route.ts` — `POST` is invoked and parses the JSON body with `createNoteSchema`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the cookie into `session`.
3. `src/lib/validation/parse-schema.ts` — `parseSchema()` rejects malformed payloads before business logic.
4. `src/services/note-service.ts` — `createNote()` starts a transaction and decides that the creator should also be inserted as an `OWNER` collaborator.
5. `src/repositories/note-repository.ts` — `createNote()` creates the note, owner collaborator row, and initial `NoteRevision`.
6. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_CREATED` inside the same transaction.
7. Returns `201` with `{ note }`.

Request: Save edits to an existing note with optimistic concurrency
1. `src/app/api/notes/[noteId]/route.ts` — `PUT` parses `noteId` params and `updateNoteSchema`, including `baseVersionNumber`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
3. `src/lib/validation/parse-schema.ts` — `parseSchema()` validates both params and body.
4. `src/services/note-service.ts` — `updateNote()` loads the note, calls `getNoteAccessLevel()`, and runs `assertCanEditNote()`.
5. `src/repositories/note-repository.ts` — `findAccessibleById()` scopes the fetch through `buildAccessibleNoteWhere()`.
6. `src/repositories/note-repository.ts` — `updateNoteWithRevisionIfVersionMatches()` performs the compare-and-swap update on `currentVersionNumber` and inserts the next `NoteRevision`.
7. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_UPDATED`.
8. Returns `200` with `{ note }`.

Request: Share a note with another user as the owner
1. `src/app/api/notes/[noteId]/share/route.ts` — `POST` parses `noteId` params and `shareNoteSchema`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
3. `src/services/note-service.ts` — `upsertCollaborator()` loads the note, computes access with `getNoteAccessLevel()`, and runs `assertCanManageSharing()`.
4. `src/repositories/user-repository.ts` — `findByEmail()` resolves the collaborator identity.
5. `src/repositories/note-repository.ts` — `upsertCollaborator()` inserts or updates the `NoteCollaborator` row.
6. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_COLLABORATOR_UPSERTED`.
7. Returns `200` with `{ note }`.

Request: Reject a stale note save after another collaborator already wrote a newer version
1. `src/app/api/notes/[noteId]/route.ts` — `PUT` parses the body and forwards the request.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the caller.
3. `src/services/note-service.ts` — `updateNote()` loads the current note through `findAccessibleById()`.
4. `src/services/note-service.ts` — `updateNote()` compares `input.baseVersionNumber` to `currentNote.currentVersionNumber`.
5. `src/repositories/audit-log-repository.ts` — `create()` writes `NOTE_CONFLICT_REJECTED`.
6. Returns `409` with `error: "VERSION_CONFLICT"` and `details.latestNote`.

Request: Reject a member calling the admin audit endpoint
1. `src/app/api/admin/audit-logs/route.ts` — `GET` composes `withAuth(withRole(["APP_ADMIN"], ...))`.
2. `src/lib/middleware/with-auth.ts` — `withAuth()` resolves the session.
3. `src/lib/middleware/with-role.ts` — `withRole()` checks `session.user.role`.
4. `src/services/audit-log-service.ts` is never called because the request is rejected here.
5. Returns `403` with `error: "FORBIDDEN"`.
