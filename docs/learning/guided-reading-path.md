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
