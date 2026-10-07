# Concepts Demonstrated

## Service layer
Where to look: `src/services/note-service.ts` — `updateNote()` and `upsertCollaborator()` apply business rules, transactions, and DTO mapping before the response leaves the backend.
Also see: `src/services/auth-service.ts` for the auth version of the same pattern.
Risk if wrong: Routes start owning business decisions, which makes behavior inconsistent and difficult to review.

## Repository pattern
Where to look: `src/repositories/note-repository.ts` — `findAccessibleById()` and `updateNoteWithRevisionIfVersionMatches()` isolate Prisma query details from the service layer.
Also see: `src/repositories/session-repository.ts` for session persistence.
Risk if wrong: Database access leaks into routes and services, making scoping and transactions inconsistent.

## Zod validation boundary
Where to look: `src/lib/validation/note-schemas.ts` — `updateNoteSchema` requires `baseVersionNumber`; `src/lib/validation/parse-schema.ts` — `parseSchema()` turns bad payloads into `422` errors.
Also see: `src/lib/validation/auth-schemas.ts` for the login boundary.
Risk if wrong: Invalid payloads reach business logic and create hidden assumptions or security bugs.

## Auth/session flow
Where to look: `src/services/auth-service.ts` — `login()` creates a hashed session token and `src/lib/auth/session.ts` — `resolveRequestSession()` turns the cookie back into an `AppSession`.
Also see: `src/app/api/auth/login/route.ts` and `src/app/api/auth/logout/route.ts`.
Risk if wrong: Cookies stop matching revocable server sessions, making logout and session invalidation unreliable.

## Role-based access control
Where to look: `src/lib/middleware/with-role.ts` — `withRole()` rejects non-admin callers before the admin handler runs.
Also see: `src/app/api/admin/audit-logs/route.ts` for the concrete admin route wiring.
Risk if wrong: Sensitive admin endpoints become reachable by ordinary members.

## Resource-level access control
Where to look: `src/lib/auth/permissions.ts` — `getNoteAccessLevel()` derives note-specific capabilities from ownership, collaborator permission, and status.
Also see: `src/services/note-service.ts` — `assertCanManageSharing()` and `assertCanChangeStatus()` call sites.
Risk if wrong: Editors could escalate sharing or archived notes could still accept writes.

## Optimistic concurrency
Where to look: `src/services/note-service.ts` — `updateNote()` compares `baseVersionNumber`, and `src/repositories/note-repository.ts` — `updateNoteWithRevisionIfVersionMatches()` performs the compare-and-swap write.
Also see: `src/lib/validation/note-schemas.ts` — `updateNoteSchema`.
Risk if wrong: One collaborator can silently overwrite a newer save from another collaborator.

## Status transition enforcement
Where to look: `src/services/note-service.ts` — `updateStatus()` rejects same-state transitions and only then writes the new `Note.status`.
Also see: `src/lib/auth/permissions.ts` — `assertCanChangeStatus()`.
Risk if wrong: Archive and restore behavior becomes inconsistent across clients and server paths.

## Audit logging
Where to look: `src/repositories/audit-log-repository.ts` — `create()` writes standardized events, and `src/services/audit-log-service.ts` — `listRecent()` shapes them for the admin UI.
Also see: `src/services/auth-service.ts` and `src/services/note-service.ts` for actual write sites.
Risk if wrong: Incident review, security investigation, and permission debugging lose reliable operational history.

## Client/server state separation
Where to look: `src/features/notes/components/notes-workspace.tsx` — draft state is local, while `src/features/notes/hooks/use-notes.ts` manages React Query server state.
Also see: `src/lib/http/fetcher.ts` — `ApiClientError` for conflict-aware client handling.
Risk if wrong: The UI mutates cached server truth before the backend accepts the write, causing stale or phantom state.

## Dependency injection through factory functions
Where to look: `src/services/note-service.ts:141` — `buildNoteService(deps)` and `src/services/auth-service.ts:28` — `buildAuthService(deps)`. Each module exports a default instance built from the real repositories (`note-service.ts:451`, `auth-service.ts:82`) and also exports the factory.
Also see: `src/lib/middleware/with-auth.ts:24-28` (`deps.resolveSession`) and `src/lib/auth/session.ts:18-26` (`SessionResolverDeps`).
Risk if wrong: Business rules can only be tested against a real database, so tests get slow and few. The note-service tests (`tests/services/note-service.test.ts:17-26`) and all ten service checks in this docs pass work only because of this seam.

## Compare-and-swap write
Where to look: `src/repositories/note-repository.ts:179-196`. `updateMany` with `currentVersionNumber: expected` in the `where`, then `count === 0` means somebody else won.
Also see: `prisma/schema.prisma:121` — `@@unique([noteId, versionNumber])` as the database-level backstop.
Risk if wrong: A read-then-write without the condition in the `where` loses edits under concurrency, even when the in-memory version check passed. Compare `updateStatus()` (`note-repository.ts:239-245`), which has no such condition (finding F5).

## Transactions spanning repositories
Where to look: `src/services/note-service.ts:155-175`, `:263-293`, `:351-373`, `:421-435`. The service opens `$transaction(async (db) => ...)` and passes `db` into each repository write, so the domain write and its audit row commit or roll back together.
Also see: `src/lib/db/prisma.ts:26` — `DatabaseClient = PrismaClient | Prisma.TransactionClient`, which is why repository methods accept either.
Risk if wrong: A repository method that ignores `db` silently runs outside the transaction. `findAccessibleById()` has no `db` parameter (`note-repository.ts:103-108`) and is called inside the save transaction (`note-service.ts:292`), so it reads from outside it (finding F2).

## DTO mapping at the service boundary
Where to look: `src/services/note-service.ts:37-125` — `toRevisionDto()`, `toCollaboratorDto()`, `toSummaryDto()`, `toDetailDto()`. Dates become ISO strings, and only selected user fields leave the server.
Also see: `src/types/note.ts` for the DTO types; `src/services/audit-log-service.ts:14-32`.
Risk if wrong: Returning Prisma rows directly would send `passwordHash` if any include ever selected the full user. Every user include in the repositories uses an explicit `select` (`note-repository.ts:38-44`, `:50-56`, `:66-71`; `session-repository.ts:30-36`), and the DTOs narrow again.

## Uniform error envelope
Where to look: `src/lib/http/app-error.ts` (typed `statusCode` and `code`), `src/lib/http/api-response.ts:15-34` (`apiError()`), and `src/lib/http/fetcher.ts:36-42` (client unwraps `message` into `ApiClientError`).
Also see: the status code catalogue in [../architecture/request-lifecycle.md](../architecture/request-lifecycle.md#status-code-catalogue).
Risk if wrong: Each route invents its own error shape and the client has to special-case them. The weak spot here is that only `AppError` is mapped, so a `SyntaxError` from `request.json()` becomes `500` (finding F1, run).

## Opaque, hashed session tokens
Where to look: `src/lib/auth/session-token.ts:11-14` and `src/lib/auth/session.ts:43-59`.
Also see: `prisma/schema.prisma:65` — `tokenHash @unique`.
Risk if wrong: Storing raw tokens turns a database read leak into account takeover. JWT-only sessions could not be revoked on logout.

## Where each original concept is incomplete

Each concept above is genuinely demonstrated. These are its limits, so a learner does not over-generalize from this codebase.

| Concept | Gap in this codebase | Evidence |
| --- | --- | --- |
| Service layer | `toSummaryDto()` has a dead fallback branch (`note.ownerId ? "OWNER" : "VIEWER"`); `ownerId` is always set | `note-service.ts:85-86`, check S9 |
| Repository pattern | read methods do not accept a transaction client | `note-repository.ts:78-129` |
| Zod validation boundary | only covers parsed JSON; unparseable bodies are `500` | `api-response.ts:27-33`, check H4 |
| Auth/session flow | expired sessions are never deleted; logout needs a live session | `session.ts:53`, `with-auth.ts:32-40` |
| Role-based access control | used on one route; a second helper, `assertSystemRole()`, is unused | `permissions.ts:27-35` |
| Resource-level access control | co-owners have full owner powers; access can be lowered but not removed | `permissions.ts:57`, `share/route.ts`, check S4 |
| Optimistic concurrency | the lost-race path is not audited, and archive-during-save is misreported | `note-service.ts:295-311`, check S2 |
| Status transition enforcement | the status write itself is not conditional | `note-repository.ts:239-245`, check S8 |
| Audit logging | not durable across deletes (`onDelete: Cascade`); login audit is outside a transaction | `schema.prisma:132-133`, `auth-service.ts:45-55` |
| Client/server state separation | conflict recovery does not refetch the detail query, so the reloaded draft can stay hidden until the next fetch | `notes-workspace.tsx:211-229` |
