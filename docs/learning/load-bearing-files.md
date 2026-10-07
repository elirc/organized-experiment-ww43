# Load-Bearing Files

## prisma/schema.prisma
- What it does: Defines the relational model for users, sessions, notes, collaborator permissions, revisions, and audit logs.
- What calls it: Prisma Client generation, all repository files, and `prisma/seed.ts`.
- What it calls: Nothing directly; it is the source model for generated Prisma client types.
- What would break or become insecure if this file were wrong: Missing or mis-modeled collaborator rows would make access control ambiguous; missing `NoteRevision` uniqueness would break version history integrity.
- What a junior engineer would likely miswrite here: They might skip the `NoteCollaborator` join table and try to infer access from owner fields only.

## src/repositories/note-repository.ts
- What it does: Owns note queries, collaborator scoping, revision reads, versioned writes, and status updates.
- What calls it: `src/services/note-service.ts`.
- What it calls: `src/lib/db/prisma.ts` and generated Prisma client methods.
- What would break or become insecure if this file were wrong: A missing collaborator filter in `buildAccessibleNoteWhere()` would leak notes and revision history across users.
- What a junior engineer would likely miswrite here: They might fetch notes by `id` directly in one code path and forget to reuse the shared access filter.

## src/services/note-service.ts
- What it does: Applies authorization, conflict handling, transactions, DTO mapping, and note workflow rules.
- What calls it: `src/app/api/notes/route.ts`, `src/app/api/notes/[noteId]/route.ts`, `src/app/api/notes/[noteId]/share/route.ts`, `src/app/api/notes/[noteId]/status/route.ts`, and `src/app/api/notes/[noteId]/revisions/route.ts`.
- What it calls: `src/lib/auth/permissions.ts`, `src/repositories/note-repository.ts`, `src/repositories/user-repository.ts`, and `src/repositories/audit-log-repository.ts`.
- What would break or become insecure if this file were wrong: Conflicts could silently overwrite newer edits, editors could escalate collaborator permissions, or archive rules could become inconsistent.
- What a junior engineer would likely miswrite here: They might let routes own part of the logic and create different behavior for the same action on different endpoints.

## src/lib/auth/session.ts
- What it does: Turns cookies into typed sessions for routes and server pages, and attaches or clears cookies on auth responses.
- What calls it: `src/lib/middleware/with-auth.ts`, auth routes, and server pages under `src/app`.
- What it calls: `src/repositories/session-repository.ts` and `src/lib/auth/session-token.ts`.
- What would break or become insecure if this file were wrong: Logout would stop revoking sessions correctly, or invalid cookies could be treated as valid sessions.
- What a junior engineer would likely miswrite here: They might trust the cookie value directly instead of hashing and checking the backing session row.

## src/lib/auth/permissions.ts
- What it does: Centralizes system-role checks and note access derivation.
- What calls it: `src/services/note-service.ts` and role-aware API routes.
- **Correction:** only `src/services/note-service.ts` imports this file (`:13-18`). No API route does. Routes use `withRole()` from `src/lib/middleware/with-role.ts`, and this file's `assertSystemRole()` has no call site.
- What it calls: Nothing external; it computes access from session and note data.
- What would break or become insecure if this file were wrong: Editors might gain owner-only actions, archived notes might still accept edits, or app-admin bypass rules might become inconsistent.
- What a junior engineer would likely miswrite here: They might treat “can edit” as the only rule and forget that note status also affects allowed actions.

## src/lib/middleware/with-auth.ts
- What it does: Rejects unauthenticated API calls with a consistent `401`.
- What calls it: Most route files under `src/app/api`.
- What it calls: `src/lib/auth/session.ts` — `resolveRequestSession()`.
- What would break or become insecure if this file were wrong: Some endpoints would accidentally become public or return inconsistent auth behavior.
- What a junior engineer would likely miswrite here: They might duplicate auth checks in each route and forget one of them.

## src/app/api/notes/[noteId]/route.ts
- What it does: Exposes note detail reads and conflict-aware note updates over REST.
- What calls it: `src/features/notes/hooks/use-notes.ts` — `useNoteDetailQuery()` and `useSaveNoteMutation()`.
- What it calls: `src/lib/middleware/with-auth.ts`, `src/lib/validation/parse-schema.ts`, and `src/services/note-service.ts`.
- What would break or become insecure if this file were wrong: Request params or bodies could skip validation, or routes could bypass the shared auth wrapper.
- What a junior engineer would likely miswrite here: They might implement update logic directly in the route and accidentally fork business behavior.

## src/features/notes/components/notes-workspace.tsx
- What it does: Coordinates note selection, draft editing, saving, conflict recovery, status changes, and collaborator updates.
- What calls it: `src/app/notes/page.tsx`.
- What it calls: `src/features/notes/hooks/use-notes.ts` and note UI subcomponents.
- What would break or become insecure if this file were wrong: The client could overwrite server truth locally, hide conflict feedback, or render stale note state after a mutation.
- What a junior engineer would likely miswrite here: They might bind input fields directly to React Query data and mutate cached server state before save succeeds.

## src/app/api/admin/audit-logs/route.ts
- What it does: Exposes recent audit activity only to `APP_ADMIN` users.
- What calls it: `src/features/admin/hooks/use-audit-logs.ts`.
- What it calls: `src/lib/middleware/with-auth.ts`, `src/lib/middleware/with-role.ts`, and `src/services/audit-log-service.ts`.
- What would break or become insecure if this file were wrong: Audit data would be visible to non-admins, leaking sensitive operational history.
- What a junior engineer would likely miswrite here: They might hide the admin page link but forget to lock the underlying API route.

## Additions from the docs review

The files above are the right core. The entries below are equally load-bearing but were missing. Each one is grounded in the line ranges given.

## src/lib/auth/session-token.ts
- What it does: creates a 32-byte random token (`:11`) and hashes it as `sha256(token:SESSION_SECRET)` (`:13-14`).
- What calls it: `src/services/auth-service.ts` (create and hash at login, hash at logout) and `src/lib/auth/session.ts` (hash on every lookup).
- What it calls: `node:crypto` and `src/lib/env.ts`.
- What would break or become insecure if this file were wrong: if the hash changed shape, or `SESSION_SECRET` changed, every existing session would stop matching and everyone would be logged out. If the token were short or predictable, sessions could be guessed.
- What a junior engineer would likely miswrite here: storing the raw token, or using `Math.random()`.

## src/lib/http/api-response.ts
- What it does: `ok()`, `created()`, and `apiError()` (`:11-34`). `apiError()` is the single place an exception becomes a status code.
- What calls it: every route file, plus `with-auth.ts` and `with-role.ts` for their 401 and 403 bodies.
- What it calls: `NextResponse.json` and the `AppError` class.
- What would break or become insecure if this file were wrong: if it serialized non-`AppError` messages, Prisma errors, including table and constraint names, would leak to clients. Today they become a generic `500` (`:27-33`). The flip side is that client mistakes such as invalid JSON also become `500` (finding F1).
- What a junior engineer would likely miswrite here: returning `error.message` for every error, or forgetting `details` on conflicts.

## src/lib/validation/note-schemas.ts
- What it does: the note API contract (`:10-33`). Titles 3-120 characters, bodies 1-20,000, `baseVersionNumber` a positive integer, `changeSummary` up to 160, share `permission` from the Prisma enum, status from the Prisma enum.
- What calls it: the five note route files, and `tests/lib/note-schemas.test.ts`.
- What it calls: Zod and the runtime enums from `@prisma/client`.
- What would break or become insecure if this file were wrong: making `baseVersionNumber` optional would turn every save into last-write-wins at the API level. The service would compare against `undefined` and always throw `409`, but a quick "fix" there would remove the protection entirely.
- What a junior engineer would likely miswrite here: validating `permission` as `z.string()`, or forgetting `.trim()` so whitespace-only titles pass `min(3)`.

## src/features/notes/hooks/use-notes.ts
- What it does: every note query and mutation, and the query-key scheme `["notes"]`, `["notes", id]`, `["notes", id, "revisions"]` (`:15-19`).
- What calls it: `src/features/notes/components/notes-workspace.tsx`.
- What it calls: `apiFetch()` in `src/lib/http/fetcher.ts`.
- What would break or become insecure if this file were wrong: if the key scheme changed so detail keys no longer started with `"notes"`, the save mutation's `invalidateQueries({ queryKey: ["notes"] })` (`:86`) would stop refetching the detail. The stale response from the save path (finding F2) would then stay on screen.
- What a junior engineer would likely miswrite here: invalidating `["notes", id]` only, so the sidebar version badge stays old.

## src/lib/env.ts
- What it does: parses `DATABASE_URL`, `SESSION_SECRET`, `SESSION_COOKIE_NAME` with defaults at import time (`:10-28`).
- What calls it: `session-token.ts`, `session.ts`, and the logout route.
- What it calls: Zod.
- What would break or become insecure if this file were wrong: a `SESSION_SECRET` under 16 characters makes the module throw at import, which breaks every authenticated route. Leaving the default in production makes session hashes depend on a string that is public in this repository. The `DATABASE_URL` default is never used (finding F10).
- What a junior engineer would likely miswrite here: assuming the defaults configure Prisma too.

## How load-bearing is each file? A quick test

A useful exercise is to ask, for each file, "if I deleted the key line, which check would notice?" For this repo:

| Line removed | Noticed by an existing test? | Noticed by a check run for these docs? |
| --- | --- | --- |
| collaborator filter in `buildAccessibleNoteWhere()` (`note-repository.ts:29-33`) | yes, `note-repository.test.ts` | yes, S10 |
| `withRole` on the audit route (`src/app/api/admin/audit-logs/route.ts:15`) | **no**: `route-auth.test.ts` builds its own stack | no |
| `assertCanManageSharing(access)` (`note-service.ts:340`) | **no** | yes, S5 |
| `assertCanChangeStatus(access)` (`note-service.ts:411`) | **no**: both status tests use admin | yes, S7 |
| `currentVersionNumber` condition in the CAS (`note-repository.ts:182`) | **no**: services are tested with mocked repositories | no: needs a database |
| `baseVersionNumber` in `updateNoteSchema` (`note-schemas.ts:22`) | yes, `note-schemas.test.ts` | n/a |
