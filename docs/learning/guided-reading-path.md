# Guided Reading Path

## Step 1 — src/app/api/notes/[noteId]/route.ts
**Why read this:** It is the clearest route-level example of the app’s HTTP boundary.
**What to look for:** Params parsing, body parsing, and the handoff into the note service.
**What to trace:** Called by `src/features/notes/hooks/use-notes.ts` — `useNoteDetailQuery()` and `useSaveNoteMutation()`. Calls `src/lib/middleware/with-auth.ts`, `src/lib/validation/parse-schema.ts`, and `src/services/note-service.ts` — `getNoteDetail()` / `updateNote()`.
**What a junior would likely miss:** The route does not own conflict handling; it only forwards the versioned request to the service.

## Step 2 — src/lib/middleware/with-auth.ts
**Why read this:** It shows the reusable auth boundary every protected API route depends on.
**What to look for:** How `withAuth()` resolves the session and returns a uniform `401`.
**What to trace:** Called by most files under `src/app/api`. Calls `src/lib/auth/session.ts` — `resolveRequestSession()`.
**Precisely:** 7 of the 9 route files. The exceptions are `src/app/api/auth/login/route.ts` and `src/app/api/auth/session/route.ts`.
**What a junior would likely miss:** Returning `401` here keeps transport logic consistent and prevents every route from inventing its own auth behavior.

## Step 3 — src/lib/auth/session.ts
**Why read this:** It is the bridge between cookies, database sessions, and typed request context.
**What to look for:** `resolveRequestSession()`, `getServerAppSession()`, `attachSessionCookie()`, and `clearSessionCookie()`.
**What to trace:** Called by `src/lib/middleware/with-auth.ts`, `src/app/login/page.tsx`, `src/app/notes/page.tsx`, `src/app/admin/page.tsx`, and auth routes. Calls `src/repositories/session-repository.ts`.
**What a junior would likely miss:** Server pages and API routes reuse the same session source, which keeps auth semantics aligned.

## Step 4 — src/lib/validation/note-schemas.ts
**Why read this:** It defines the real note API contract.
**What to look for:** `updateNoteSchema` requiring `baseVersionNumber`, `shareNoteSchema`, and `noteStatusSchema`.
**What to trace:** Called by note API route files and tested in `tests/lib/note-schemas.test.ts`.
**What a junior would likely miss:** Version checks belong in the request contract, not just as a comment in the UI.

## Step 5 — src/services/note-service.ts
**Why read this:** It is the main business-logic hub of the project.
**What to look for:** `updateNote()`, `upsertCollaborator()`, `updateStatus()`, and the `toDetailDto()` mapper.
**What to trace:** Called by all note API routes. Calls `src/lib/auth/permissions.ts`, `src/repositories/note-repository.ts`, `src/repositories/user-repository.ts`, and `src/repositories/audit-log-repository.ts`.
**What a junior would likely miss:** The service owns transactions and rules; routes should not decide how revisions or audit entries are written.

## Step 6 — src/lib/auth/permissions.ts
**Why read this:** It centralizes both system-role and note-level authorization.
**What to look for:** `getNoteAccessLevel()`, `assertCanEditNote()`, `assertCanManageSharing()`, and `assertCanChangeStatus()`.
**What to trace:** Called by `src/services/note-service.ts` and role-aware routes. Does not call the database directly.
**Correction:** no route imports `permissions.ts`. The only importer is `src/services/note-service.ts:13-18`. The role check that routes use is `withRole()` in `src/lib/middleware/with-role.ts`, and the system-role helper in this file, `assertSystemRole()` (`:27-35`), is never called.
**What a junior would likely miss:** Authorization is a domain decision, not a UI concern.

## Step 7 — src/repositories/note-repository.ts
**Why read this:** It contains the load-bearing data-isolation rule and the compare-and-swap update.
**What to look for:** `buildAccessibleNoteWhere()`, `findAccessibleById()`, and `updateNoteWithRevisionIfVersionMatches()`.
**What to trace:** Called by `src/services/note-service.ts`. Calls Prisma through `src/lib/db/prisma.ts`.
**What a junior would likely miss:** If `buildAccessibleNoteWhere()` is wrong, every downstream permission check becomes suspect because the wrong rows were loaded.

## Step 8 — prisma/schema.prisma
**Why read this:** It makes the relational model and permission shape concrete.
**What to look for:** `NoteCollaborator`, `NoteRevision`, and nullable `AuditLog.actorId`.
**What to trace:** Used by all repository files and seeded by `prisma/seed.ts`.
**What a junior would likely miss:** Access-control decisions become easier to review when collaboration is a first-class table instead of ad hoc fields.

## Step 9 — src/features/notes/hooks/use-notes.ts
**Why read this:** It is the client-side server-state boundary.
**What to look for:** Query keys, invalidation strategy, and the save/share/status mutations.
**What to trace:** Called by `src/features/notes/components/notes-workspace.tsx`. Calls note API routes.
**What a junior would likely miss:** Cache invalidation belongs near the mutation, not in random component callbacks.

## Step 10 — src/features/notes/components/notes-workspace.tsx
**Why read this:** It shows how the UI coordinates draft state without owning business logic.
**What to look for:** Derived `effectiveSelectedNoteId`, draft-state shaping, and conflict recovery using `ApiClientError`.
**What to trace:** Called by `src/app/notes/page.tsx`. Calls note hooks plus `NoteEditor`, `NoteSidebar`, `CollaboratorPanel`, and `VersionHistoryPanel`.
**What a junior would likely miss:** Draft state is separate from the React Query cache so unsaved edits do not mutate server truth.

## Step 11 — src/app/api/admin/audit-logs/route.ts
**Why read this:** It is the cleanest example of system-role enforcement.
**What to look for:** `withAuth(withRole(["APP_ADMIN"], ...))`.
**What to trace:** Called by `src/features/admin/hooks/use-audit-logs.ts`. Calls `src/services/audit-log-service.ts`.
**What a junior would likely miss:** Page redirects are not enough; admin-only APIs must enforce roles themselves.

## Step 12 — tests/repositories/note-repository.test.ts
**Why read this:** It proves the data-isolation seam is small enough to test directly.
**What to look for:** The expected `where` shape for member and admin note queries.
**What to trace:** Tests `src/repositories/note-repository.ts` — `buildAccessibleNoteWhere()`.
**What a junior would likely miss:** Testing the query-shape helper is often the cheapest way to catch a future data leak before it reaches the database.

## Three files the path skips

These are short and worth reading between steps 3 and 5.

- `src/lib/auth/session-token.ts` (17 lines). How a cookie value becomes a database key. Note that the hash includes `SESSION_SECRET` (`:13-14`).
- `src/lib/http/api-response.ts` (34 lines). The one place errors become HTTP. Anything that is not an `AppError` becomes `500` (`:27-33`).
- `src/lib/validation/parse-schema.ts` (26 lines). Why validation errors are `422` and what `details` contains.

Step 3's caller list also misses `src/app/page.tsx:9`, which calls `getServerAppSession()` to redirect signed-in visitors.

## Reading rungs with exercises

Each rung is a question you should be able to answer from the code alone. Expected answers follow each question, with the lines that settle it. Try before reading the answer.

### Rung 1: the boundary

**1.1** A request reaches `PUT /api/notes/abc` with no cookie and a body that is not JSON. What status comes back, and why not 500?
*Answer:* `401 UNAUTHENTICATED`. `withAuth()` resolves the session before the inner callback calls `innerRequest.json()` (`src/app/api/notes/[noteId]/route.ts:33-37`, `src/lib/middleware/with-auth.ts:31-40`). The 500 for bad JSON (finding F1) only happens to signed-in callers.

**1.2** Why do the three `[noteId]` routes write `withAuth(async (...) => {...})(request)` instead of `export const PUT = withAuth(...)` like `src/app/api/notes/route.ts`?
*Answer:* `withAuth()` returns a function of `request` only (`with-auth.ts:30`). It drops Next's second argument, which carries `params`. The dynamic routes need `context.params`, so they close over it and build the wrapper per request.

**1.3** What is the HTTP status for a title of `"ab"`? For a title of `"   ab   "`?
*Answer:* both `422 VALIDATION_ERROR`. `title` is `.trim().min(3)` (`src/lib/validation/note-schemas.ts:20`), so the padded value trims to 2 characters.

### Rung 2: sessions

**2.1** A database dump leaks the `Session` table. Can the attacker log in as those users?
*Answer:* not with the dump alone. The table stores `sha256(token:SESSION_SECRET)` (`src/lib/auth/session-token.ts:13-14`), and the cookie must be the raw token. They would also need `SESSION_SECRET`, and even then they would have to invert SHA-256 over 32 random bytes.

**2.2** A user's role is changed from `APP_ADMIN` to `MEMBER` directly in the database. When does `/api/admin/audit-logs` start returning 403 for them?
*Answer:* on their next request. The session lookup includes `user.role` from the `User` row each time (`src/repositories/session-repository.ts:26-40`), and `withRole()` reads `context.session.user.role` (`src/lib/middleware/with-role.ts:24`).

**2.3** Does visiting `/notes` repeatedly keep a session alive past 14 days?
*Answer:* no. The expiry is fixed at login (`src/lib/auth/session.ts:104-108`), and nothing extends it. Page loads do not even update `lastSeenAt` (`:61-74`).

### Rung 3: permissions

**3.1** Fill in `canEdit`, `canManageSharing`, `canArchive` for an `EDITOR` on an ARCHIVED note.
*Answer:* `false, false, false` (`src/lib/auth/permissions.ts:58-66`). This was checked by running the function (check P4).

**3.2** A `VIEWER` sends `PUT` to an ARCHIVED note. 403 or 409?
*Answer:* `409 NOTE_ARCHIVED`, because `assertCanEditNote()` checks status before capability (`permissions.ts:72-80`, check P5).

**3.3** A user who is not a collaborator requests `GET /api/notes/<real id>`. What do they get, and which line decides it?
*Answer:* `404 NOTE_NOT_FOUND` from `src/services/note-service.ts:187-189`, because the scoped `findFirst` returns `null` (`src/repositories/note-repository.ts:103-108`). The `404` thrown inside `getNoteAccessLevel()` (`permissions.ts:53-55`) is a backstop that a member cannot normally reach, because the scoped query already filtered them out.

**3.4** Owner Nina shares the note with Eli as `OWNER`. Can Eli now archive it? Can Eli demote Nina to `EDITOR`?
*Answer:* yes, and no. Eli's `OWNER` row makes `isOwner` true (`permissions.ts:57`), so `canArchive` is true. Demoting Nina hits `collaborator.id === note.ownerId` and returns `422 INVALID_PERMISSION_CHANGE` (`note-service.ts:347-349`). Check S4 ran this scenario.

### Rung 4: concurrency

**4.1** Two editors load version 5 and both save. Walk through what each one receives.
*Answer:* see "Flow: Lose a race to another editor" in [flow-traces.md](flow-traces.md). One gets `200` and creates revision 6. The other gets `409 VERSION_CONFLICT` from the race path (`note-service.ts:295-311`), with no `NOTE_CONFLICT_REJECTED` audit row.

**4.2** Why is the `@@unique([noteId, versionNumber])` constraint on `NoteRevision` still useful if the conditional update already prevents double writes?
*Answer:* it is a database-level backstop. If a future code path inserted a revision without the conditional update, or computed `nextVersionNumber` wrongly, the insert would fail instead of silently creating two "version 6" rows (`prisma/schema.prisma:121`).

**4.3** Which write path in the service has no compare-and-swap, and what is the visible effect?
*Answer:* `updateStatus()`. The repository update is `where: { id }` only (`src/repositories/note-repository.ts:239-245`). Two concurrent archive calls both succeed and both write an audit row (finding F5, check S8).

### Rung 5: client state

**5.1** After a successful save, which query keys are invalidated, and does the detail refetch?
*Answer:* `["notes"]` and `["notes", id, "revisions"]` (`src/features/notes/hooks/use-notes.ts:85-88`). React Query matches keys by prefix, so `["notes"]` also covers `["notes", id]`, and yes, the detail refetches.

**5.2** Where does the editor keep unsaved text, and when does it throw that text away?
*Answer:* in the `draft` state in `notes-workspace.tsx:58-70`. The draft only shows while `draft.noteId` and `draft.versionNumber` match the loaded note (`:74-91`). When the note's version changes, for example after a refetch shows someone else's save, the draft is silently replaced by server values.

**5.3** A member opens `/admin` directly. What happens on the server, and what would happen if the page check were removed?
*Answer:* `src/app/admin/page.tsx:21-23` redirects to `/notes`. Without that check the page would render, but `AuditLogView`'s query would get `403` from `withRole()` and show no rows. The component has no error state (`src/features/admin/components/audit-log-view.tsx:31-54`).

### Rung 6: change something (on a branch)

These are exercises, not changes made in this repo.

1. Fix F1: add a `readJson()` helper beside `parseSchema()` that maps `SyntaxError` to `400 INVALID_JSON`, use it in the five routes, and add the route test from [testing-rationale.md](testing-rationale.md#tests-worth-adding-tied-to-findings).
2. Fix F3 and F4 together in the `!updated` branch of `updateNote()`.
3. Add `DELETE /api/notes/[noteId]/share` (F7). Decide which audit action it writes. The `AuditAction` enum needs a new value and a schema change.
4. Make `updateStatus()` conditional (F5) and write the test that proves the second concurrent call gets `409`.
