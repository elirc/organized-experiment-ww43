# Testing Rationale

## `tests/lib/route-auth.test.ts` — `member callers receive 403 on an admin-only endpoint`
This is worth testing because UI-only admin hiding is a classic false sense of security. The test proves the server wrapper in `src/lib/middleware/with-role.ts` still rejects a signed-in member before `src/services/audit-log-service.ts` can run.

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
