# Build Journal

## Stage 1 — Project framing
Built: Chose a backend-first collaborative notes app with note sharing, version history, audit logging, and explicit conflict handling.
Decision: Kept multi-tenancy out of v1 because the product problem is per-note ownership, not org isolation.
Why: It keeps the architecture focused on access control and collaboration without adding tenant plumbing the requirements do not need.

## Stage 2 — Stack choice
Built: Next.js App Router, TypeScript, React Query, Tailwind, Prisma, PostgreSQL schema, Zod, and REST routes.
Decision: Chose Prisma over Drizzle and REST over tRPC.
Why: Prisma gives a very readable relational model for a junior-to-mid engineer, and REST makes request lifecycle, auth wrappers, status codes, and validation boundaries easier to trace.

## Stage 3 — Domain model
Built: `User`, `Session`, `Note`, `NoteCollaborator`, `NoteRevision`, and `AuditLog` in `prisma/schema.prisma`.
Decision: Modeled sharing as a first-class join table and revisions as immutable snapshots.
Why: It makes authorization queryable and version history append-only.

## Stage 4 — Auth and authorization
Built: Session helpers in `src/lib/auth/session.ts`, auth middleware in `src/lib/middleware/with-auth.ts`, role middleware in `src/lib/middleware/with-role.ts`, and note-level permission helpers in `src/lib/auth/permissions.ts`.
Decision: Used hashed opaque session tokens stored in the database instead of stateless JWT-only auth.
Why: It makes logout and revocation real, which is closer to common internal CRUD apps.

## Stage 5 — Service and repository boundaries
Built: `src/services/note-service.ts`, `src/services/auth-service.ts`, `src/repositories/note-repository.ts`, and related repository files.
Decision: Put transactions and permission checks in services, and all Prisma query shapes in repositories.
Why: The service layer owns rules; the repository layer owns persistence.

## Stage 6 — Client workflow layer
Built: React Query hooks in `src/features/notes/hooks/use-notes.ts` and the main workspace in `src/features/notes/components/notes-workspace.tsx`.
Decision: Kept draft editor state local while server state stays in React Query.
Why: Unsaved edits should not mutate cached server truth.

## Stage 7 — Verification
Built: Focused tests for route RBAC, validation, note-state transitions, conflict detection, and repository scoping.
Decision: Chose targeted unit tests over full integration DB setup for this project slice.
Why: The goal was to pin the highest-risk rules quickly while keeping the test harness lightweight.

## Decision Log

### Decision: ORM choice
Why it matters: The ORM shapes how readable the data layer feels and how easy it is to teach relational access control and transactions.
Options:
- Prisma: very readable schema and nested relational writes; tradeoff is generated client churn across major versions.
- Drizzle: highly explicit SQL-like modeling; tradeoff is more manual ceremony in a teaching-oriented CRUD app.
- Raw SQL/query builder: maximum control; tradeoff is too much incidental complexity for this scope.
Choice: Prisma.
Why this choice won: `prisma/schema.prisma` and `src/repositories/note-repository.ts` are easier to read for the collaboration model than a more SQL-heavy stack.
What junior/mid/senior engineers notice:
- Junior: the schema is approachable and maps directly to the product.
- Mid: nested writes and typed includes keep repository code concise.
- Senior: ORM version churn exists, so upgrades need deliberate handling.

### Decision: API style
Why it matters: The API style affects how obvious auth, validation, and status codes are.
Options:
- REST route handlers: explicit status codes and request lifecycles.
- tRPC: strong end-to-end typing; tradeoff is less obvious raw HTTP boundaries for learning route mechanics.
- Server actions only: less boilerplate; tradeoff is weaker teaching surface for backend request flows.
Choice: REST route handlers in `src/app/api`.
Why this choice won: The docs and tests can trace exact request boundaries through route files, middleware, validation, services, and repositories.
What junior/mid/senior engineers notice:
- Junior: easier to see where requests enter the system.
- Mid: status codes and auth wrappers are centralized and reusable.
- Senior: REST keeps the backend contract explicit for future non-React clients.

### Decision: Conflict handling
Why it matters: Collaboration apps need a deterministic answer when two editors save near the same time.
Options:
- Last-write-wins: simplest, but silently loses work.
- Pessimistic locking: safer writes, but heavier operationally and awkward for web UX.
- CRDT/real-time merge: powerful, but much more complex than the requirement needs.
- Optimistic concurrency: explicit base version plus conflict response.
Choice: optimistic concurrency through `baseVersionNumber`.
Why this choice won: `src/lib/validation/note-schemas.ts` and `src/services/note-service.ts` make the rule explicit, testable, and realistic for corporate CRUD systems.
What junior/mid/senior engineers notice:
- Junior: “version number” is not optional metadata; it is the write contract.
- Mid: compare-and-swap belongs in the repository write path.
- Senior: conflict response shape matters because clients need deterministic recovery behavior.

### Decision: Multi-tenancy
Why it matters: Tenant scope changes every future query shape and permission decision.
Options:
- Add org/tenant support now: future-proof, but larger upfront complexity.
- Defer multi-tenancy and keep note ownership explicit: simpler now, leaves a clear seam for later.
Choice: defer multi-tenancy.
Why this choice won: `src/repositories/note-repository.ts` — `buildAccessibleNoteWhere()` already acts as the future scoping seam, so adding `tenantId` later would be an extension, not a rewrite.
What junior/mid/senior engineers notice:
- Junior: fewer moving parts to understand.
- Mid: access control is still explicit without full tenant plumbing.
- Senior: future tenant adoption is easiest when scope logic is already centralized.

## PR Slices

### Slice 1 — Domain and persistence skeleton
Purpose in one sentence: Establish the relational model and database-facing boundaries for notes, revisions, sharing, sessions, and audit logs.
Files with novel logic:
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/repositories/note-repository.ts`
- `src/repositories/session-repository.ts`
- `src/repositories/audit-log-repository.ts`
Reviewer focus:
- `prisma/schema.prisma`: verify `NoteCollaborator` and `NoteRevision` relationships near the middle of the file.
- `src/repositories/note-repository.ts`: verify `buildAccessibleNoteWhere()` and `updateNoteWithRevisionIfVersionMatches()`.
- `prisma/seed.ts`: verify seeded collaborator rows and revision history.
What a junior reviewer might approve without questioning: An unscoped note query that fetches by `id` directly instead of reusing `buildAccessibleNoteWhere()`.

### Slice 2 — Auth and permission boundary
Purpose in one sentence: Add cookie-backed sessions, reusable auth wrappers, and centralized permission helpers.
Files with novel logic:
- `src/lib/auth/session.ts`
- `src/lib/auth/permissions.ts`
- `src/lib/middleware/with-auth.ts`
- `src/lib/middleware/with-role.ts`
- `src/services/auth-service.ts`
Reviewer focus:
- `src/lib/auth/session.ts`: verify token hashing and session lookup flow around `resolveRequestSession()`.
- `src/lib/auth/permissions.ts`: verify admin bypass and note-owner rules in `getNoteAccessLevel()`.
- `src/services/auth-service.ts`: verify failed logins are audited before returning `401`.
What a junior reviewer might approve without questioning: A permission helper that checks collaborator permission but forgets note status.

### Slice 3 — Note CRUD, revisions, and conflict handling
Purpose in one sentence: Implement the main notes API and service behavior for create, read, save, and revision history.
Files with novel logic:
- `src/app/api/notes/route.ts`
- `src/app/api/notes/[noteId]/route.ts`
- `src/app/api/notes/[noteId]/revisions/route.ts`
- `src/services/note-service.ts`
- `src/lib/validation/note-schemas.ts`
Reviewer focus:
- `src/services/note-service.ts`: verify `updateNote()` rejects stale versions before or during the write path.
- `src/repositories/note-repository.ts`: verify the compare-and-swap update around `currentVersionNumber`.
- `src/lib/validation/note-schemas.ts`: verify `updateNoteSchema` requires `baseVersionNumber`.
What a junior reviewer might approve without questioning: Returning `200` on a conflict and forcing the client to guess that a retry is needed.

### Slice 4 — Sharing, admin reporting, and status transitions
Purpose in one sentence: Add owner-managed collaborator updates, archive/restore behavior, and admin audit visibility.
Files with novel logic:
- `src/app/api/notes/[noteId]/share/route.ts`
- `src/app/api/notes/[noteId]/status/route.ts`
- `src/app/api/admin/audit-logs/route.ts`
- `src/services/audit-log-service.ts`
- `src/app/admin/page.tsx`
Reviewer focus:
- `src/services/note-service.ts`: verify `upsertCollaborator()` blocks non-owners and preserves owner permission.
- `src/services/note-service.ts`: verify `updateStatus()` rejects same-state transitions.
- `src/app/api/admin/audit-logs/route.ts`: verify the route is wrapped with both `withAuth()` and `withRole()`.
What a junior reviewer might approve without questioning: A sharing route that only checks note read access and accidentally lets editors change collaborator permissions.

### Slice 5 — Client workflow, tests, and learning artifacts
Purpose in one sentence: Wire the UI to the API, recover cleanly from conflicts, and document the architecture for guided reading.
Files with novel logic:
- `src/features/notes/hooks/use-notes.ts`
- `src/features/notes/components/notes-workspace.tsx`
- `tests/lib/route-auth.test.ts`
- `tests/services/note-service.test.ts`
- `docs/architecture/request-lifecycle.md`
- `docs/learning/flow-traces.md`
Reviewer focus:
- `src/features/notes/components/notes-workspace.tsx`: verify draft state is kept separate from query cache and conflict recovery reads `details.latestNote`.
- `tests/repositories/note-repository.test.ts`: verify the scoping helper is tested directly.
- `docs/learning/flow-traces.md`: verify traces name real functions and real files rather than hypothetical architecture.
What a junior reviewer might approve without questioning: A client conflict handler that simply retries the save, causing repeated overwrite attempts instead of surfacing the newer version.
