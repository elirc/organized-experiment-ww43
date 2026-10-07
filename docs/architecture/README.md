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

**Correction (order of steps 1-3):** authentication runs *before* any params or body parsing. Each exported handler is either the `withAuth(...)` wrapper itself (`src/app/api/notes/route.ts:17`, `:26`) or a function that builds `withAuth(...)` and immediately calls it with the request (`src/app/api/notes/[noteId]/route.ts:21-31`). The inner callback, where `parseSchema()` runs, only executes after `withAuth()` has resolved a session (`src/lib/middleware/with-auth.ts:30-42`). So the real order is: route export, then `withAuth()` (401 if no session), then `withRole()` where present (403), then `parseSchema()` on params and body (422), then the service. The two public auth routes (`login`, `session`) have no wrapper at all.

## What is in the repo, by size

Counts below come from `git ls-files` at the commit these docs describe.

| Area | Files | Notes |
| --- | --- | --- |
| API route files (`src/app/api/**/route.ts`) | 9 | 11 exported handlers in total; see the inventory below |
| Server pages (`src/app/**/page.tsx`) | 4 | `/`, `/login`, `/notes`, `/admin` |
| Services | 3 | `note-service.ts` is 454 lines and holds almost all business rules |
| Repositories | 4 | `note`, `session`, `user`, `audit-log` |
| `src/lib` helpers | 16 | auth (5), http (3), validation (3), middleware (2), env, db, utils |
| Feature UI (`src/features`) | 11 | 7 components, 4 hook files |
| Tests | 4 test files + 2 fixture helpers | 7 test cases in total |

There is no `src/middleware.ts` (no Next.js edge middleware), no `prisma/migrations/` folder, and no sign-up, password-reset, note-delete, or collaborator-remove endpoint.

## Route inventory

Every HTTP handler in the app. "Gate" is the wrapper that runs before the handler body. See [auth-and-permissions.md](auth-and-permissions.md) for the per-route permission table.

| Method and path | File | Gate | Service call |
| --- | --- | --- | --- |
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts:17-28` | none (public) | `authService.login()` |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts:17-34` | `withAuth` | `authService.logout()` |
| `GET /api/auth/session` | `src/app/api/auth/session/route.ts:13-16` | none (returns `{ session: null }` when anonymous) | `resolveRequestSession()` directly |
| `GET /api/notes` | `src/app/api/notes/route.ts:17-24` | `withAuth` | `noteService.listNotes()` |
| `POST /api/notes` | `src/app/api/notes/route.ts:26-34` | `withAuth` | `noteService.createNote()` |
| `GET /api/notes/[noteId]` | `src/app/api/notes/[noteId]/route.ts:21-31` | `withAuth` | `noteService.getNoteDetail()` |
| `PUT /api/notes/[noteId]` | `src/app/api/notes/[noteId]/route.ts:33-44` | `withAuth` | `noteService.updateNote()` |
| `GET /api/notes/[noteId]/revisions` | `src/app/api/notes/[noteId]/revisions/route.ts:21-31` | `withAuth` | `noteService.listRevisions()` |
| `POST /api/notes/[noteId]/share` | `src/app/api/notes/[noteId]/share/route.ts:21-32` | `withAuth` | `noteService.upsertCollaborator()` |
| `PATCH /api/notes/[noteId]/status` | `src/app/api/notes/[noteId]/status/route.ts:21-32` | `withAuth` | `noteService.updateStatus()` |
| `GET /api/admin/audit-logs` | `src/app/api/admin/audit-logs/route.ts:14-23` | `withAuth(withRole(["APP_ADMIN"]))` | `auditLogService.listRecent()` |

The three dynamic-segment routes use the Next.js 16 signature where `context.params` is a `Promise` (`src/app/api/notes/[noteId]/route.ts:17-19`). That is why each one does `await context.params` before `parseSchema(noteIdParamsSchema, ...)`.

## Server pages

| Page | File | Session check | Behavior |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx:8-13` | `getServerAppSession()` | signed in: redirect to `/notes`; otherwise a marketing card with a link to `/login` |
| `/login` | `src/app/login/page.tsx:13-17` | `getServerAppSession()` | signed in: redirect to `/notes` |
| `/notes` | `src/app/notes/page.tsx:13-19` | `getServerAppSession()` | anonymous: redirect to `/login`; otherwise renders `NotesWorkspace` with the session |
| `/admin` | `src/app/admin/page.tsx:15-23` | `getServerAppSession()` | anonymous: `/login`; non-admin: `/notes` |

Pages use `getServerAppSession()`, which reads the cookie through `next/headers` and does **not** update `Session.lastSeenAt` (`src/lib/auth/session.ts:61-74`). Only API calls through `resolveRequestSession()` touch the session (`src/lib/auth/session.ts:57`).

## Runtime configuration

`src/lib/env.ts:10-28` parses three variables with Zod at import time:

| Variable | Default | Used by | Note |
| --- | --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/collab_notes` | nothing in `src/` | Prisma reads `env("DATABASE_URL")` itself (`prisma/schema.prisma:17`). The Zod default never reaches `new PrismaClient()` (`src/lib/db/prisma.ts:18-20`). |
| `SESSION_SECRET` | `dev-session-secret-change-me` | `hashSessionToken()` (`src/lib/auth/session-token.ts:13-14`) | Must be 16+ characters or `env.ts` throws at import, which breaks every route that imports it. Changing it invalidates every existing session, because stored hashes no longer match. |
| `SESSION_COOKIE_NAME` | `collab_notes_session` | `session.ts`, logout route | |

The session cookie's `secure` flag is `process.env.NODE_ENV === "production"` (`src/lib/auth/session.ts:86`). A production build served over plain HTTP sets a cookie the browser will not send back, so login appears to succeed and the next page redirects to `/login`.

`src/lib/db/prisma.ts:16-24` keeps one `PrismaClient` on `global.prisma` outside production to survive hot reloads. It logs `warn` and `error` in development and only `error` otherwise.

## Dependency injection seams

Two services and one middleware take their collaborators as arguments, which is what makes the unit tests possible without a database:

- `buildNoteService(deps)` (`src/services/note-service.ts:141`) takes `prisma`, `noteRepository`, `userRepository`, `auditLogRepository`. The exported `noteService` is `buildNoteService()` with the real modules (`:451`).
- `buildAuthService(deps)` (`src/services/auth-service.ts:28`) takes the three repositories. No test currently uses it.
- `withAuth(handler, { resolveSession })` (`src/lib/middleware/with-auth.ts:24-28`) lets tests replace session resolution.
- `resolveRequestSession(request, deps)` and `getServerAppSession(deps)` take repository functions (`src/lib/auth/session.ts:18-26`).

The repositories themselves accept an optional `db` (transaction client) on write methods, but **not** on the read methods `findAccessibleById()`, `listAccessibleForUser()`, `listAccessibleRevisions()` (`src/repositories/note-repository.ts:78-129`). That gap matters inside transactions; see finding F2 in [auth-and-permissions.md](auth-and-permissions.md#findings).

## Error envelope

Every handled error leaves through `apiError()` (`src/lib/http/api-response.ts:15-34`):

- An `AppError` becomes `{ error: code, message, details: details ?? null }` with `error.statusCode`.
- Anything else becomes `500 { error: "INTERNAL_SERVER_ERROR", message }`, with no `details` key.

The two wrappers build their own bodies with `ok(..., status)`: `withAuth` returns `401 { error: "UNAUTHENTICATED", message }` and `withRole` returns `403 { error: "FORBIDDEN", message }` (`src/lib/middleware/with-auth.ts:33-39`, `src/lib/middleware/with-role.ts:25-31`). Neither includes `details`. Client code only reads `message` and `status` (`src/lib/http/fetcher.ts:36-42`), so the difference is harmless today.

## Where to go next

- [auth-and-permissions.md](auth-and-permissions.md): gates, sessions, capabilities, findings.
- [domain-model.md](domain-model.md): fields, constraints, cascade rules, invariants.
- [request-lifecycle.md](request-lifecycle.md): every request path with status codes.
- [../learning/guided-reading-path.md](../learning/guided-reading-path.md): the reading order with exercises.

A note on scope: this documentation set was expanded about 3.3x in a review pass, and it stops there on purpose. The server code is about 25 files, and the docs already trace every route, service method, and finding to a line. More text would repeat those traces rather than add new facts.
