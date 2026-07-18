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
