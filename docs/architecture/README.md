# Architecture Overview

This project is a Next.js App Router application that keeps transport, business rules, and database access in separate layers so request flow is easy to read. Auth uses cookie-backed sessions, note collaboration uses explicit `NoteCollaborator` rows, and note saves use optimistic concurrency through a required `baseVersionNumber`.

## Top-level folders

- `src/app`
  `src/app/api/notes/[noteId]/route.ts` is the HTTP boundary for note reads and writes, while `src/app/notes/page.tsx` and `src/app/admin/page.tsx` are server-rendered entry points that redirect based on session state.
- `src/lib`
  Cross-cutting infrastructure lives here: `src/lib/auth/session.ts` resolves session cookies, `src/lib/middleware/with-auth.ts` and `src/lib/middleware/with-role.ts` guard routes, `src/lib/validation/note-schemas.ts` defines request shapes, and `src/lib/http/api-response.ts` standardizes responses.
- `src/services`
  Business rules live here. `src/services/note-service.ts` owns note CRUD, conflict handling, sharing, and status changes. `src/services/auth-service.ts` owns credential verification and session creation. `src/services/audit-log-service.ts` shapes admin audit responses.
- `src/repositories`
  Prisma queries are centralized here. `src/repositories/note-repository.ts` owns every query that touches notes, revisions, and collaborator scoping. `src/repositories/session-repository.ts` owns session persistence. `src/repositories/audit-log-repository.ts` owns audit writes and admin reads.
- `src/features`
  Client-side UI and React Query hooks live here. `src/features/notes/hooks/use-notes.ts` is the client-side server-state boundary. `src/features/notes/components/notes-workspace.tsx` coordinates the editor, version history, and collaborator panel.
- `prisma`
  `prisma/schema.prisma` defines the relational model. `prisma/seed.ts` creates realistic demo users, collaboration rows, revisions, and audit logs.
- `tests`
  Focused tests cover permission rejection, validation, state transitions, and data isolation. `tests/lib/route-auth.test.ts` checks admin-route protection, while `tests/repositories/note-repository.test.ts` checks the load-bearing note-scope filter.

## Layer relationship

Requests move in this order:

1. `src/app/api/.../route.ts` parses params/body and chooses the service call.
2. `src/lib/middleware/with-auth.ts` and `src/lib/middleware/with-role.ts` reject unauthenticated or unauthorized callers early.
3. `src/lib/validation/*.ts` schemas and `src/lib/validation/parse-schema.ts` validate the request boundary.
4. `src/services/*.ts` applies business rules and transaction boundaries.
5. `src/repositories/*.ts` issues scoped Prisma queries.
6. DTOs from `src/types/*.ts` shape the response for React Query hooks in `src/features`.
