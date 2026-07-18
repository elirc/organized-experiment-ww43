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
