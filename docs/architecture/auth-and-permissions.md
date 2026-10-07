# Auth And Permissions

Auth is cookie-backed and server-enforced from the first request boundary. Session cookies are resolved in `src/lib/auth/session.ts` by `resolveRequestSession()` for API routes and `getServerAppSession()` for server pages like `src/app/notes/page.tsx` and `src/app/admin/page.tsx`.

## Session flow

- Login starts in `src/app/api/auth/login/route.ts` where `POST()` parses `loginSchema` from `src/lib/validation/auth-schemas.ts`.
- `src/services/auth-service.ts` — `login()` looks up the user through `src/repositories/user-repository.ts` — `findByEmail()`, verifies the password through `src/lib/auth/password.ts` — `verifyPassword()`, creates a session row through `src/repositories/session-repository.ts` — `create()`, and writes an audit event through `src/repositories/audit-log-repository.ts` — `create()`.
- The response cookie is attached in `src/lib/auth/session.ts` — `attachSessionCookie()`.
- Logout starts in `src/app/api/auth/logout/route.ts`. The route is wrapped by `src/lib/middleware/with-auth.ts` — `withAuth()`, then `src/services/auth-service.ts` — `logout()` deletes the hashed token via `src/repositories/session-repository.ts` — `deleteByTokenHash()`.

## Route authentication

- `src/lib/middleware/with-auth.ts` — `withAuth()` is the reusable authentication gate for API routes. It calls `resolveRequestSession()` and returns a `401` JSON response before the route handler runs if the cookie is missing or invalid.
- `src/app/api/notes/route.ts`, `src/app/api/notes/[noteId]/route.ts`, `src/app/api/notes/[noteId]/share/route.ts`, and `src/app/api/notes/[noteId]/status/route.ts` all compose their handlers through `withAuth()`.

**Correction (incomplete list):** `src/app/api/notes/[noteId]/revisions/route.ts:22`, `src/app/api/auth/logout/route.ts:17`, and `src/app/api/admin/audit-logs/route.ts:14` also go through `withAuth()`. That is 7 of the 9 route files. The two that do not are `POST /api/auth/login` (public by design) and `GET /api/auth/session` (returns `200 { session: null }` for anonymous callers, `src/app/api/auth/session/route.ts:13-16`).

## Role-based access control

- System-role enforcement is centralized in `src/lib/middleware/with-role.ts` — `withRole()`.
- `src/app/api/admin/audit-logs/route.ts` wraps its handler with `withAuth(withRole(["APP_ADMIN"], ...))`, so the admin route rejects a signed-in `MEMBER` before calling `src/services/audit-log-service.ts`.
- The notes UI also redirects non-admins away from `/admin` in `src/app/admin/page.tsx`, but that is only a UX layer. The real security check is the API wrapper in `src/lib/middleware/with-role.ts`.

**Correction (two role helpers, one used):** there is a second system-role helper, `assertSystemRole()` in `src/lib/auth/permissions.ts:27-35`, which throws `403 FORBIDDEN`. It has no call site anywhere in `src/` or `tests/` (checked with a repo-wide search). `withRole()` is the only role check that actually runs, and it is used on exactly one route. The `APP_ADMIN` role also has a second effect that is not a gate at all: it widens data scope in `buildAccessibleNoteWhere()` and grants owner capabilities in `getNoteAccessLevel()` (see below).

## Note-level permissions

- Resource permissions are centralized in `src/lib/auth/permissions.ts`.
- `getNoteAccessLevel()` turns the note owner id, note status, and collaborator rows into a single access object with `canEdit`, `canManageSharing`, and `canArchive`.
- `assertCanEditNote()`, `assertCanManageSharing()`, and `assertCanChangeStatus()` are called inside `src/services/note-service.ts` before any write occurs.
- Editors can modify note content through `updateNote()`, but only owners or app admins can call `upsertCollaborator()` and `updateStatus()`.

**Clarification:** "owners" here means any collaborator whose row says `OWNER`, not only the user in `Note.ownerId`. `isOwner` is `collaborator.permission === "OWNER" || note.ownerId === session.user.id` (`src/lib/auth/permissions.ts:57`). Because the share endpoint accepts `permission: "OWNER"` (`src/lib/validation/note-schemas.ts:26-29`) and the UI offers it (`src/features/notes/components/collaborator-panel.tsx:95-97`), an owner can create co-owners who get full sharing and archive powers. See finding F6.

## Data isolation

- Member note scoping is centralized in `src/repositories/note-repository.ts` — `buildAccessibleNoteWhere()`.
- For `MEMBER` users, `buildAccessibleNoteWhere()` adds `collaborators: { some: { userId: sessionUserId } }` to every note query path.
- `listAccessibleForUser()`, `findAccessibleById()`, and `listAccessibleRevisions()` all call `buildAccessibleNoteWhere()`, so note lists, note detail, and revision history share the same access filter.
- `APP_ADMIN` is intentionally handled as an explicit exception inside `buildAccessibleNoteWhere()`, which keeps the bypass path reviewable in one function instead of scattered across routes.

Write paths do not call `buildAccessibleNoteWhere()` themselves. `updateNoteWithRevisionIfVersionMatches()`, `upsertCollaborator()`, and `updateStatus()` filter only by `id` (`src/repositories/note-repository.ts:179-192`, `:220-231`, `:239-245`). They are safe today only because every service write method first loads the note through `findAccessibleById()` and throws `404` if it is not visible (`src/services/note-service.ts:224-232`, `:322-330`, `:393-401`). A new write method that skips that load would bypass scoping.

## Validation boundary

- Input validation is explicit in `src/lib/validation/auth-schemas.ts` and `src/lib/validation/note-schemas.ts`.
- `src/lib/validation/parse-schema.ts` — `parseSchema()` converts Zod failures into `422 VALIDATION_ERROR` responses before service code runs.
- Conflict protection is part of the validation and service contract: `src/lib/validation/note-schemas.ts` — `updateNoteSchema` requires `baseVersionNumber`, and `src/services/note-service.ts` — `updateNote()` rejects stale versions with `409 VERSION_CONFLICT`.

**Correction (malformed JSON is not a validation error):** `parseSchema()` only sees the payload after `await request.json()` has succeeded. A body that is not valid JSON makes `request.json()` throw a `SyntaxError`, which is not an `AppError`, so `apiError()` returns `500 INTERNAL_SERVER_ERROR` (`src/lib/http/api-response.ts:27-33`). This was run against the real `src/app/api/notes/route.ts` with stubbed session and service modules (check H4 below). The same `await request.json()` pattern is in `login/route.ts:19`, `[noteId]/route.ts:37`, `share/route.ts:25`, and `status/route.ts:25`. See finding F1.

## Inside the auth wrapper

What `withAuth()` does, line by line (`src/lib/middleware/with-auth.ts:24-43`):

1. `resolveSession` is `deps.resolveSession` if a test passed one, else the real `resolveRequestSession` (`:28`).
2. The returned function takes only `request`. It does not forward the Next.js route context, which is why dynamic routes capture `context.params` in a closure and call `withAuth(...)(request)` themselves (`src/app/api/notes/[noteId]/route.ts:21-31`).
3. `await resolveSession(request)` (`:31`). Inside `resolveRequestSession()` (`src/lib/auth/session.ts:43-59`):
   - Read the cookie named `env.SESSION_COOKIE_NAME`, trim it, and treat an empty string as missing (`:41`, `:47`). No cookie means `null`. There is no header fallback and no default user, so no "headerless admin" path exists.
   - Hash the token with `sha256(token + ":" + SESSION_SECRET)` (`src/lib/auth/session-token.ts:13-14`) and look it up by the unique `tokenHash` (`src/repositories/session-repository.ts:26-40`).
   - No row, or `expiresAt <= now`, means `null` (`:52-55`, `isExpired` at `:28`). Expired rows are not deleted.
   - Otherwise update `lastSeenAt` (`:57`) and return `{ sessionId, expiresAt, user: { id, email, name, role } }`.
4. `null` means the wrapper returns `401 { error: "UNAUTHENTICATED", message: "You must sign in before calling this endpoint." }` and the handler never runs (`:32-40`). This was run (check H1).
5. Otherwise `handler(request, { session })` (`:42`).

`withRole(allowedRoles, handler)` (`src/lib/middleware/with-role.ts:19-36`) is an inner handler. It checks `allowedRoles.includes(context.session.user.role)` and returns `403 { error: "FORBIDDEN" }` when the role is missing (check H2). It must be nested *inside* `withAuth`, because it reads `context.session`. Used alone it would throw a `TypeError` on `undefined.user`.

The role is read from the `User` row on every request (the session lookup includes `user.role`, `src/repositories/session-repository.ts:29-37`), so demoting a user in the database takes effect on their next request without logging them out.

## Route gate table

| Handler | File:line | Auth gate | Role gate | Service-level check | Denied status |
| --- | --- | --- | --- | --- | --- |
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts:17` | none | none | password verify in `auth-service.ts:32` | `401 INVALID_CREDENTIALS`, `422` bad shape, `500` bad JSON |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts:17` | `withAuth` | none | none | `401` if the session is already invalid |
| `GET /api/auth/session` | `src/app/api/auth/session/route.ts:13` | none | none | none | never denies; `200 { session: null }` |
| `GET /api/notes` | `src/app/api/notes/route.ts:17` | `withAuth` | none | scope in `buildAccessibleNoteWhere()` | `401` |
| `POST /api/notes` | `src/app/api/notes/route.ts:26` | `withAuth` | none | none: any signed-in user can create | `401`, `422`, `500` bad JSON |
| `GET /api/notes/[noteId]` | `src/app/api/notes/[noteId]/route.ts:21` | `withAuth` | none | `findAccessibleById()` then `getNoteAccessLevel()` | `401`, `404 NOTE_NOT_FOUND` |
| `PUT /api/notes/[noteId]` | `src/app/api/notes/[noteId]/route.ts:33` | `withAuth` | none | `assertCanEditNote()` (`note-service.ts:242`) | `401`, `404`, `403`, `409 NOTE_ARCHIVED`, `409 VERSION_CONFLICT`, `422` |
| `GET /api/notes/[noteId]/revisions` | `src/app/api/notes/[noteId]/revisions/route.ts:21` | `withAuth` | none | `findAccessibleById()` plus scoped revision query | `401`, `404` |
| `POST /api/notes/[noteId]/share` | `src/app/api/notes/[noteId]/share/route.ts:21` | `withAuth` | none | `assertCanManageSharing()` (`note-service.ts:340`), owner-demotion guard (`:347-349`) | `401`, `404`, `403`, `404 USER_NOT_FOUND`, `422 INVALID_PERMISSION_CHANGE` |
| `PATCH /api/notes/[noteId]/status` | `src/app/api/notes/[noteId]/status/route.ts:21` | `withAuth` | none | `assertCanChangeStatus()` (`note-service.ts:411`), same-state guard (`:413-419`) | `401`, `404`, `403`, `409 INVALID_STATUS_TRANSITION` |
| `GET /api/admin/audit-logs` | `src/app/api/admin/audit-logs/route.ts:14` | `withAuth` | `withRole(["APP_ADMIN"])` | none | `401`, `403` |

Note the `404`-before-`403` ordering for notes. A member who is not a collaborator gets `404 NOTE_NOT_FOUND` from the scoped query (`note-service.ts:187-189`), so they cannot tell "exists but not shared with me" from "does not exist". A collaborator who lacks the capability gets `403`.

## Capability matrix

What `getNoteAccessLevel()` (`src/lib/auth/permissions.ts:37-70`) returns. Every row was run against the real function (checks P2, P3, P4).

| Caller | Note status | `permission` | `canEdit` | `canManageSharing` | `canArchive` |
| --- | --- | --- | --- | --- | --- |
| `APP_ADMIN` (collaborator or not) | ACTIVE | `OWNER` | true | true | true |
| `APP_ADMIN` | ARCHIVED | `OWNER` | false | true | true |
| `Note.ownerId` user (row `OWNER`) | ACTIVE | `OWNER` | true | true | true |
| co-owner (row `OWNER`, not `ownerId`) | ACTIVE | `OWNER` | true | true | true |
| `EDITOR` | ACTIVE | `EDITOR` | true | false | false |
| `VIEWER` | ACTIVE | `VIEWER` | false | false | false |
| any collaborator | ARCHIVED | (their row) | false | unchanged | unchanged |
| member with no collaborator row | any | throws `404 NOTE_NOT_FOUND` | | | |

How the assert helpers turn that into status codes (checks P5, P6):

| Helper | Throws when | Status / code |
| --- | --- | --- |
| `assertCanEditNote()` (`:72-80`) | `noteStatus === "ARCHIVED"` (checked first) | `409 NOTE_ARCHIVED` |
| | `!canEdit` | `403 FORBIDDEN` |
| `assertCanManageSharing()` (`:82-90`) | `!canManageSharing` | `403 FORBIDDEN` |
| `assertCanChangeStatus()` (`:94-98`) | `!canArchive` | `403 FORBIDDEN` |

Because the archived check runs first, a `VIEWER` who tries to edit an archived note gets `409 NOTE_ARCHIVED`, not `403` (check P5). That leaks nothing new (a viewer can already see the status), but it means the client message says "restore before editing" to someone who could never edit.

`isOwner` is computed and returned but nothing outside `permissions.ts` reads it. `toDetailDto()` copies only `permission`, `canEdit`, `canManageSharing`, `canArchive` (`src/services/note-service.ts:116-121`).

## Session lifecycle

| Step | Where | Detail |
| --- | --- | --- |
| Token creation | `src/lib/auth/session-token.ts:11` | 32 random bytes, hex encoded (64 characters) |
| Storage | `src/services/auth-service.ts:45-49` | only `sha256(token:SESSION_SECRET)` is stored, in the unique `Session.tokenHash` (`prisma/schema.prisma:65`) |
| Lifetime | `src/lib/auth/constants.ts:7`, `src/lib/auth/session.ts:104-108` | 14 days from login; fixed, not sliding. `lastSeenAt` is updated but never used to extend `expiresAt` |
| Cookie | `src/lib/auth/session.ts:76-90` | `httpOnly`, `sameSite: "lax"`, `secure` only in production, `path: "/"`, `expires` = session expiry |
| API lookup | `src/lib/auth/session.ts:43-59` | DB lookup on every request plus a `lastSeenAt` write |
| Page lookup | `src/lib/auth/session.ts:61-74` | same lookup, no `lastSeenAt` write |
| Logout | `src/app/api/auth/logout/route.ts:17-34`, `src/services/auth-service.ts:73-79` | `deleteMany({ tokenHash })`, `LOGOUT` audit, cookie cleared with `expires: new Date(0)` |
| Expiry cleanup | none | there is no job or query that deletes expired rows; `@@index([expiresAt])` (`prisma/schema.prisma:72`) exists but nothing uses it |
| Password hashing | `src/lib/auth/password.ts:9-16` | bcryptjs, cost 12 |

Logout only works with a live session. If the cookie is expired or its row is gone, `withAuth()` returns `401` before the handler runs, so `clearSessionCookie()` (`logout/route.ts:29`) is never reached and the stale cookie stays in the browser until its own expiry. The UI does not hit this in practice, because pages redirect an expired session to `/login` first.

There is no "log out everywhere" and no session list. A user with several devices has several rows, and only the current device's row is deleted on logout.

## Family defect pattern checks

These are the patterns this repo family is checked for. Each line says what was found and how it was verified.

| Pattern | Result | Evidence |
| --- | --- | --- |
| Headerless-admin default (fall back to a privileged user when no cookie or header) | **Not present** | `resolveRequestSession()` returns `null` for a missing or blank cookie (`src/lib/auth/session.ts:47-50`); `withAuth` turns that into `401` (run, H1 and H5) |
| Zod error becomes 500 | **Not present for Zod**; **present for bad JSON** | `parseSchema()` maps Zod failures to `422` (`src/lib/validation/parse-schema.ts:12-20`, by reading; Zod is not installed in the checkout); a JSON `SyntaxError` becomes `500` (run, H3 and H4) |
| `*/` inside a block comment ending it early | **Not present** | searched all of `src/`, `prisma/`, `tests/` for `*/` that is not a comment terminator; none. Globs in comments such as `src/lib/middleware/*.ts` (`src/types/auth.ts:3`) contain `/*`, which is harmless inside a block comment |
| Never-enforced permission or role | **One unused helper** | `assertSystemRole()` (`src/lib/auth/permissions.ts:27-35`) has no call site; every `NotePermission` level is enforced (run, P2-P6) |
| Check-then-act race | **Present on status change**; note save is protected | Save uses a conditional `updateMany` plus `@@unique([noteId, versionNumber])` (`note-repository.ts:179-196`, `schema.prisma:121`). Status change reads, compares, then writes unconditionally (`note-service.ts:413`, `note-repository.ts:239-245`). See F5 |
| IDOR / cross-user read | **Not found** | all reads go through `buildAccessibleNoteWhere()`; the revisions route is scoped twice (`note-service.ts:195-209`) |
| Missing transition guard | **Partial** | same-state status change is rejected (`note-service.ts:413-419`); sharing is allowed on archived notes (run, S6) |
| Unused helpers | **Yes** | `assertSystemRole()`, `userRepository.findSessionUserById()` (`src/repositories/user-repository.ts:16-26`), `ConflictPayload` type (`src/types/note.ts:74-81`) |
| Tests that never run | **No** | `vitest.config.ts:7` includes `tests/**/*.test.ts`, which matches all four test files |

## Findings

Numbered so other docs can refer to them. "(run)" means the behavior was executed in a scratch copy of the code; "(by reading)" means it was not.

**F1. Malformed JSON bodies return 500, not 400 (run).**
`await request.json()` runs inside the route's `try`, and its `SyntaxError` is not an `AppError`, so `apiError()` falls through to `500 INTERNAL_SERVER_ERROR` (`src/lib/http/api-response.ts:27-33`). Affected: `src/app/api/auth/login/route.ts:19`, `src/app/api/notes/route.ts:28`, `src/app/api/notes/[noteId]/route.ts:37`, `src/app/api/notes/[noteId]/share/route.ts:25`, `src/app/api/notes/[noteId]/status/route.ts:25`. Check H4 posted `{not json` to the real `POST /api/notes` handler and got `500`, with the service never called.
Fix sketch: add a `readJson(request)` helper next to `parseSchema()` that catches the parse error and throws `appError("Request body must be valid JSON.", 400, "INVALID_JSON")`, then use it in the five routes.

**F2. A successful save probably returns the pre-save note (by reading; call shape run).**
After the conditional update, `updateNote()` re-reads the note *inside* the `$transaction` callback with `deps.noteRepository.findAccessibleById(noteId, session.user.id, session.user.role)` (`src/services/note-service.ts:292`). `findAccessibleById()` takes no `db` argument and always uses the global client (`src/repositories/note-repository.ts:103-108`). With Prisma interactive transactions on PostgreSQL, the global client uses a different connection, which under the default READ COMMITTED isolation cannot see the transaction's uncommitted update. So the `200` response is expected to carry the old `currentVersionNumber`, title, and body. Check S3 confirmed the call shape: the CAS write receives the transaction client, but the re-read is called with three arguments and no client. The PostgreSQL visibility part was not run, because there is no database in this checkout.
Client impact: `useSaveNoteMutation` writes that response into the detail cache (`src/features/notes/hooks/use-notes.ts:84`), then invalidates the `["notes"]` prefix, which also covers `["notes", id]` and refetches the detail (`:85-88`). That hides most of the problem. The visible symptom is the message `Saved version N.` showing the *old* number (`src/features/notes/components/notes-workspace.tsx:209`).
Fix sketch: give `findAccessibleById()` an optional `db` parameter and pass `db` at line 292, or move the re-read after the transaction resolves.

**F3. A save that loses the race is not audited as a conflict (run).**
There are two conflict paths. The pre-check path (`note-service.ts:244-261`) writes `NOTE_CONFLICT_REJECTED` and throws `409`. The race path, where the pre-check passed but the conditional `updateMany` matched zero rows (`:295-311`), throws the same `409` without writing any audit row. Check S2 confirmed that no audit call happens. An admin reading the audit log under-counts exactly the conflicts that matter most: true concurrent edits.
Fix sketch: write `NOTE_CONFLICT_REJECTED` in the `!updated` branch too, with `actualVersionNumber: latest.currentVersionNumber`.

**F4. A note archived mid-save is reported as a version conflict (by reading).**
The conditional update also requires `status: "ACTIVE"` (`src/repositories/note-repository.ts:183`). If the note is archived between the pre-check and the write, `updateMany` matches zero rows and the service reports `409 VERSION_CONFLICT` (`note-service.ts:306-311`), even though the version did not change. The client then shows "A newer revision already exists" (`notes-workspace.tsx:225-227`) instead of "Archived notes must be restored before editing."
Fix sketch: in the `!updated` branch, check `latest.status === "ARCHIVED"` and throw `409 NOTE_ARCHIVED` instead.

**F5. Status change is check-then-act (run as a simulation).**
`updateStatus()` reads the note, rejects same-state changes (`note-service.ts:413-419`), then writes with `note.update({ where: { id } })`, which has no status condition (`note-repository.ts:239-245`). Two concurrent "archive" requests that both read `ACTIVE` both write, and both log `NOTE_STATUS_CHANGED { from: "ACTIVE", to: "ARCHIVED" }`. Check S8 reproduced this with a fake repository that returns the same `ACTIVE` snapshot to both calls. The end state is still correct (archived). The damage is a duplicate audit row and a misleading `from` value.
Fix sketch: `updateMany({ where: { id, status: from }, data: { status: to } })` and treat `count === 0` as `409 INVALID_STATUS_TRANSITION`.

**F6. Co-owners can manage other co-owners (run).**
Any collaborator with an `OWNER` row passes `assertCanManageSharing()` and `assertCanChangeStatus()` (`permissions.ts:57-60`). The only protection is that nobody can demote the `Note.ownerId` user (`note-service.ts:347-349`). Check S4 showed a co-owner granting `OWNER` to an editor, then demoting themselves to `VIEWER`, both accepted, and showed the attempt to demote `Note.ownerId` rejected with `422 INVALID_PERMISSION_CHANGE`. Whether co-owners should be able to do this is a product decision. The code does not document it, and the UI offers `Owner` in the share dropdown (`collaborator-panel.tsx:97`).
Fix sketch: if co-ownership is not intended, remove `OWNER` from `shareNoteSchema` and base `isOwner` on `note.ownerId` only.

**F7. Access can be downgraded but never removed (by reading).**
`src/app/api/notes/[noteId]/share/route.ts` exports only `POST`, and the repository has no collaborator delete (`src/repositories/note-repository.ts:212-232` is the only collaborator write). The strongest revocation available is `VIEWER`, which still lets the user read the note and its full revision history. There is also no note delete endpoint. Rows are only removed by database cascades.
Fix sketch: `DELETE /api/notes/[noteId]/share/[userId]`, gated by `assertCanManageSharing()`, refusing to remove `Note.ownerId`, with a new audit action.

**F8. Unknown emails skip bcrypt, so login timing reveals which emails exist (by reading).**
`if (!user || !(await verifyPassword(...)))` short-circuits when `user` is null (`src/services/auth-service.ts:32`), so the bcrypt cost-12 comparison (`src/lib/auth/password.ts:9`) only runs for real accounts. A response that is noticeably faster means "no such user". There is also no rate limit or lockout on `POST /api/auth/login`. Failed attempts are audited (`auth-service.ts:33-37`) but nothing reads those rows automatically. Not measured here: `bcryptjs` is not installed in the checkout.
Fix sketch: compare against a fixed dummy hash when the user is missing; add a per-email and per-IP attempt counter.

**F9. Expired sessions are never cleaned up, and logout needs a live session (by reading).**
See "Session lifecycle" above. Expired rows stay forever. `POST /api/auth/logout` with an expired cookie returns `401` and leaves the cookie in place (`with-auth.ts:32-40` runs before `logout/route.ts:28-29`).
Fix sketch: a periodic `session.deleteMany({ where: { expiresAt: { lt: new Date() } } })`; make logout clear the cookie even when the session is gone (do not wrap it in `withAuth`, or catch the 401 case).

**F10. `DATABASE_URL` default in `env.ts` is dead configuration (by reading).**
`src/lib/env.ts:11-14` supplies a default database URL, but `env.DATABASE_URL` is never read. `new PrismaClient()` (`src/lib/db/prisma.ts:18-20`) gets no `datasources` override, so Prisma uses `env("DATABASE_URL")` from `prisma/schema.prisma:17` and fails if the variable is unset, whatever `env.ts` says. Separately, `SESSION_SECRET` silently falls back to a public string in any environment (`env.ts:15-18`).
Fix sketch: drop the `DATABASE_URL` default (or pass it to `PrismaClient`), and refuse the default secret when `NODE_ENV === "production"`.

**F11. Deleting a user or note deletes its audit history (by reading).**
`AuditLog.actor` and `AuditLog.note` are `onDelete: Cascade` (`prisma/schema.prisma:132-133`). The app has no delete endpoint today, so this is latent. But any future account or note deletion erases exactly the records an investigation would need. Meanwhile `NoteRevision.editedBy` is `onDelete: Restrict` (`:119`), so deleting a user who ever edited someone else's note fails outright. See [domain-model.md](domain-model.md#delete-behavior).
Fix sketch: `onDelete: SetNull` on both `AuditLog` relations (the columns are already nullable), and decide explicitly what user deletion means for revisions.

**F12. Unbounded revision history read (by reading).**
`listAccessibleRevisions()` has no `take` (`src/repositories/note-repository.ts:110-129`) and returns every full `bodySnapshot`. The detail include already returns the latest 8 (`:60-74`), and the UI renders the full list in `VersionHistoryPanel`. Each body can be up to 20,000 characters (`note-schemas.ts:21`), so a note with a few hundred saves returns megabytes per page load.
Fix sketch: paginate with `take` and a cursor on `versionNumber`, and return excerpts in the list.

**F13. Stale documentation inside the code (by reading).**
Route header comments name hook files that do not exist: `use-note-revisions.ts` (`src/app/api/notes/[noteId]/revisions/route.ts:3`), `use-note-detail.ts` and `use-save-note.ts` (`[noteId]/route.ts:3`), `use-share-note.ts` (`share/route.ts:3`), `use-note-status.ts` (`status/route.ts:3`). All of those hooks live in `src/features/notes/hooks/use-notes.ts`. The `ConflictPayload` type (`src/types/note.ts:74-81`) puts `latestNote` at the top level, but the wire format nests it under `details.latestNote` (`api-response.ts:21`, `note-service.ts:259`). The client correctly reads `details.latestNote` (`notes-workspace.tsx:213`) and does not use the type.

## Checks that were run

Scratch setup: `git archive HEAD src` into a scratch folder, and a Node module-resolution hook that maps `@/` to the copied `src/` and replaces `@prisma/client`, `next/server`, `@/lib/auth/session`, `@/lib/validation/parse-schema`, and `@/lib/validation/note-schemas` with tiny stubs. Zod, Prisma, and Next are not installed in the checkout, and nothing was installed. All other modules (`permissions.ts`, `app-error.ts`, `api-response.ts`, `with-auth.ts`, `with-role.ts`, `note-service.ts`, `note-repository.ts`, `src/app/api/notes/route.ts`) are the real files.

Command: `node --experimental-transform-types --import ./register.mjs --test checks/*.test.mjs` on Node 22.16. The HTTP file was run with `STUB_SERVICE=1` so the route got a recording service. Result: 22 of 22 passed.

| ID | What it exercised | Result |
| --- | --- | --- |
| P1 | non-collaborator member to `getNoteAccessLevel()` | throws `404 NOTE_NOT_FOUND` |
| P2 | capability matrix for owner, editor, viewer, co-owner on ACTIVE | as in the table above |
| P3 | admin with no collaborator row | `OWNER`, all capabilities |
| P4 | ARCHIVED note | `canEdit` false for all, owner keeps `canArchive` |
| P5 | `assertCanEditNote()` for viewer, ARCHIVED vs ACTIVE | `409 NOTE_ARCHIVED` vs `403 FORBIDDEN` |
| P6 | editor against sharing and status asserts | `403` both |
| P7 | `assertSystemRole()` in isolation | works, but unused |
| S1 | stale `baseVersionNumber` | `409 VERSION_CONFLICT`, `details.latestNote`, one `NOTE_CONFLICT_REJECTED` audit |
| S2 | CAS returns false (lost race) | `409`, zero audit rows (F3) |
| S3 | successful save, call shape | CAS gets the transaction client; the re-read does not (F2) |
| S4 | co-owner grants OWNER, demotes self, tries to demote `ownerId` | first two accepted, third `422` (F6) |
| S5 | editor shares; owner shares to unknown email | `403`; `404 USER_NOT_FOUND` |
| S6 | owner shares an ARCHIVED note | accepted and audited |
| S7 | status: same-state, editor, owner | `409`, `403`, success plus audit |
| S8 | two concurrent archives on the same ACTIVE snapshot | both write, two audits (F5) |
| S9 | admin note list with no collaborator row | `currentUserPermission: "OWNER"` |
| S10 | `buildAccessibleNoteWhere()` without `noteId` | member scoped, admin `{}` |
| H1 | `withAuth` with no session | `401 UNAUTHENTICATED`, handler not called |
| H2 | `withAuth(withRole(["APP_ADMIN"]))` with a member | `403` |
| H3 | `apiError()` on `AppError` vs `SyntaxError` | mapped status vs `500` |
| H4 | real `POST /api/notes` with body `{not json` | `500 INTERNAL_SERVER_ERROR`, service not called (F1) |
| H5 | real `GET /api/notes` with no session | `401` |

Not run: anything that needs PostgreSQL (real isolation behavior for F2, the unique constraints), Zod parsing (the schemas were stubbed), bcrypt timing (F8), and cookie handling in a browser.

## Multi-tenancy

Multi-tenancy is not included in this version because the product requirements are satisfied by per-note ownership and collaborator sharing rather than organization isolation.

To add multi-tenancy later without rewriting the whole app:

- Add `Tenant` and `Membership` models in `prisma/schema.prisma`.
- Add `tenantId` to `Note`, `AuditLog`, and any future tenant-owned models.
- Extend `src/lib/auth/session.ts` so the session carries the active tenant context.
- Update `src/repositories/note-repository.ts` — `buildAccessibleNoteWhere()` to scope by both `tenantId` and collaborator membership.
- Add tenant-aware guard helpers beside `getNoteAccessLevel()` in `src/lib/auth/permissions.ts`.

One more step the list above misses: the three write methods in `note-repository.ts` filter by `id` only (see "Data isolation"). With tenants, they should also include `tenantId` in their `where`, so a bug in the service pre-load cannot cross tenants. `auditLogRepository.listRecent()` (`src/repositories/audit-log-repository.ts:42-62`) is global today and would also need a tenant filter.
