# Testing Rationale

## `tests/lib/route-auth.test.ts` — `member callers receive 403 on an admin-only endpoint`
This is worth testing because UI-only admin hiding is a classic false sense of security. The test proves the server wrapper in `src/lib/middleware/with-role.ts` still rejects a signed-in member before `src/services/audit-log-service.ts` can run.

**Correction:** the test does not touch the real audit route or `audit-log-service.ts`. It builds its own stack, `withAuth(withRole(["APP_ADMIN"], async () => ok({ success: true })))`, with a mocked session resolver (`tests/lib/route-auth.test.ts:13-18`). It proves the *wrappers* compose correctly. It does not prove that `src/app/api/admin/audit-logs/route.ts` uses them. If someone deleted `withRole` from that route, this test would still pass.

A more thorough production suite would hit the real `src/app/api/admin/audit-logs/route.ts` handler with integration fixtures, verify the exact JSON body, and test anonymous callers as well as admins.

## `tests/lib/route-auth.test.ts` — `admin callers pass the role gate`
This matters because negative-only auth tests can accidentally hide a broken route wrapper that rejects everyone. The test confirms the same wrapper stack still allows a valid admin through.

A fuller suite would also assert that the downstream admin service is called exactly once and that the route returns the expected audit payload shape.

## `tests/lib/note-schemas.test.ts` — `rejects note updates that omit the baseVersionNumber`
This test protects the optimistic-concurrency contract. If `baseVersionNumber` ever becomes optional at the validation boundary, a stale client can overwrite newer work without even giving the service a chance to detect it.

A more thorough suite would also test invalid string versions, negative version numbers, and overlong `changeSummary` values.

## `tests/repositories/note-repository.test.ts` — `scopes member note queries to collaborator membership`
This is one of the highest-value tests in the repo because `buildAccessibleNoteWhere()` is the data-isolation seam for all member note queries. If that filter disappears, the leak reaches note detail, lists, and revision history at once.

A more complete suite would run the same scoping assertions against a real database with seeded rows to prove the Prisma query behaves the way the helper intends.

## `tests/repositories/note-repository.test.ts` — `lets app admins query notes without collaborator scoping`
This matters because app-admin behavior is an intentional exception, not an accident. Testing both the constrained and bypass paths keeps the authorization story explicit.

A fuller suite would verify that admin-only pages still rely on server role checks even though repository scoping is broader for admins.

## `tests/services/note-service.test.ts` — `rejects invalid status transitions when a note is already archived`
This catches the kind of bug where archive state becomes a loose UI toggle instead of a real backend state machine. The test pins the `409 INVALID_STATUS_TRANSITION` behavior in `src/services/note-service.ts` — `updateStatus()`.

A more complete suite would test the happy path too, including the audit-log write and the follow-up fetch of the updated note.

## `tests/services/note-service.test.ts` — `returns a version conflict when the caller saves an outdated base version`
This is the test that directly guards against lost collaborator edits. It proves that `src/services/note-service.ts` returns a conflict instead of accepting a stale write.

A more thorough production suite would simulate two actual writes against a test database and verify the `details.latestNote` payload matches the real latest revision.

**Clarification (both service tests run as admin):** both tests in `tests/services/note-service.test.ts` pass `adminSession` (`:28`, `:55`). For an admin, `getNoteAccessLevel()` returns early with full capabilities (`src/lib/auth/permissions.ts:41-50`) and never looks at the collaborator list. So neither test exercises the member permission path. They only cover the version comparison and the same-state check. The conflict test also never reaches the transaction: the fixture is at version 3 and the request sends 2, so it takes the pre-check path (`src/services/note-service.ts:244-261`), not the race path (`:295-311`).

## Does `npm test` run these tests?

`npm test` is `vitest run` (`package.json:10`). `vitest.config.ts:7` includes `tests/**/*.test.ts`, which matches all four test files, and maps `@` to `./src` (`:9-13`). There is no `setupFiles`, no database, and no environment file. So yes, all 7 tests are collected. Two preconditions apply, both by reading (nothing was installed for this review, so `npm test` was not run):

1. **A generated Prisma client.** All four test files import, directly or indirectly, a module that uses `@prisma/client` at runtime, not just for types:
   - `note-schemas.test.ts` imports `note-schemas.ts`, which calls `z.enum(NotePermission)` and `z.enum(NoteStatus)` on runtime enum objects (`src/lib/validation/note-schemas.ts:7`, `:28`, `:32`).
   - `note-repository.test.ts`, `note-service.test.ts`, and `route-auth.test.ts` (through `with-auth.ts`, `session.ts`, `session-repository.ts`) import `src/lib/db/prisma.ts`, which runs `new PrismaClient()` at import time (`src/lib/db/prisma.ts:16-20`).
   `npm install` normally runs `prisma generate` through `@prisma/client`'s install hook. If it did not, run `npm run prisma:generate` first. No test opens a database connection, because Prisma connects lazily and every database call is mocked.
2. **`env.ts` must parse.** `session-token.ts` imports `env.ts`, which throws at import if `SESSION_SECRET` is set but shorter than 16 characters (`src/lib/env.ts:15-18`, `:24`). With it unset, the default is used and the tests run.

## What each test proves and does not prove

| Test | Proves | Does not prove |
| --- | --- | --- |
| `route-auth`: member gets 403 | `withAuth(withRole(["APP_ADMIN"]))` returns 403 `FORBIDDEN` for a `MEMBER` session | that the real audit route uses this stack; anonymous behavior (401); the real session resolver |
| `route-auth`: admin passes | the same stack lets `APP_ADMIN` through with 200 | anything about `auditLogService` or its payload |
| `note-schemas`: missing `baseVersionNumber` | `updateNoteSchema` rejects a body without it | rejection of `0`, negatives, strings, or floats; that the route uses this schema; 422 mapping in `parseSchema()` |
| `note-repository`: member scope | `buildAccessibleNoteWhere()` returns `{ id, collaborators: { some: { userId } } }` | that Prisma executes it as intended; that every repository method uses it (the write methods do not, see [../architecture/auth-and-permissions.md](../architecture/auth-and-permissions.md#data-isolation)) |
| `note-repository`: admin bypass | admin gets `{ id }` only | the list shape without `noteId` (`{}`), which check S10 covered |
| `note-service`: already archived | `updateStatus(admin, ..., "ARCHIVED")` on an ARCHIVED note throws `409 INVALID_STATUS_TRANSITION` | member 403 path; happy path; audit write; the F5 race |
| `note-service`: stale version | pre-check throws `409 VERSION_CONFLICT` | the audit row; the `details.latestNote` contents; the race path (F3); the success path's response (F2) |

None of the seven tests covers `auth-service.ts`, `session.ts`, `upsertCollaborator()`, `listRevisions()`, any route handler, or any client code.

## Checks run for this documentation pass

These were run with `node --test` on Node 22.16 against a scratch copy of `src/`, with `@prisma/client`, `next/server`, the session module, and the Zod schema modules stubbed, because nothing is installed in the checkout. The full list with IDs is in [../architecture/auth-and-permissions.md](../architecture/auth-and-permissions.md#checks-that-were-run). Summary:

| Group | Real modules exercised | Tests | Result |
| --- | --- | --- | --- |
| P1-P7 | `src/lib/auth/permissions.ts`, `src/lib/http/app-error.ts` | 7 | 7 pass |
| S1-S10 | `src/services/note-service.ts`, `src/repositories/note-repository.ts` (`buildAccessibleNoteWhere`) | 10 | 10 pass |
| H1-H5 | `with-auth.ts`, `with-role.ts`, `api-response.ts`, `src/app/api/notes/route.ts` | 5 | 5 pass |

Command shape: `node --experimental-transform-types --import ./register.mjs --test checks/*.test.mjs`. `--experimental-transform-types` (not just strip-types) is needed because `AppError` and `ApiClientError` use TypeScript constructor parameter properties (`src/lib/http/app-error.ts:9-14`).

## Tests worth adding, tied to findings

Each of these would fail today, or pins behavior that is currently untested. Finding numbers refer to [../architecture/auth-and-permissions.md](../architecture/auth-and-permissions.md#findings).

| Proposed test | Where | Pins | Expected today |
| --- | --- | --- | --- |
| `POST /api/notes` with body `{not json` returns 400 | route test with mocked `noteService` | F1 | fails: returns 500 |
| race-path conflict writes `NOTE_CONFLICT_REJECTED` | `note-service.test.ts`, with `updateNoteWithRevisionIfVersionMatches` returning `false` | F3 | fails: no audit row |
| CAS returns false and the latest note is ARCHIVED gives `NOTE_ARCHIVED` | same | F4 | fails: `VERSION_CONFLICT` |
| `findAccessibleById` inside the save transaction receives the tx client | same, assert the 4th argument | F2 | fails: called with 3 args |
| member `EDITOR` cannot share (403) and `VIEWER` cannot save (403) | `note-service.test.ts` with `memberSession` | capability matrix | passes; currently untested |
| co-owner cannot demote another co-owner (if that is the intended rule) | `note-service.test.ts` | F6 | fails: accepted |
| `updateNoteSchema` rejects `baseVersionNumber: 0`, `"3"`, `2.5` | `note-schemas.test.ts` | schema `.int().positive()` | passes; currently untested |
| `loginSchema` accepts `"  Owner@Notes.Local "` and yields `owner@notes.local` | new `auth-schemas.test.ts` | trim and lowercase claim in `auth-schemas.ts:10` | unknown: in Zod 4, check order on `z.email().trim()` decides whether surrounding spaces fail the email check first. Not run here (Zod not installed) |
| `buildAuthService().login()` with an unknown email writes `LOGIN_FAILED` with `actorId: null` and throws 401 | new `auth-service.test.ts` | audit claim | passes; currently untested |
| `resolveRequestSession()` returns null for an expired row and does not call `touchSession` | new `session.test.ts` using its `deps` parameter | expiry logic | passes; currently untested |
| real `GET /api/admin/audit-logs` export returns 403 for a member | route test importing the real `route.ts` with a mocked resolver | closes the gap in the first test | passes; currently untested |

The last row needs a small refactor or module mock, because the real route calls `withAuth()` without `deps`. `vi.mock("@/lib/auth/session")` is the simplest way to do it in Vitest.
