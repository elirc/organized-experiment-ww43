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

## Role-based access control

- System-role enforcement is centralized in `src/lib/middleware/with-role.ts` — `withRole()`.
- `src/app/api/admin/audit-logs/route.ts` wraps its handler with `withAuth(withRole(["APP_ADMIN"], ...))`, so the admin route rejects a signed-in `MEMBER` before calling `src/services/audit-log-service.ts`.
- The notes UI also redirects non-admins away from `/admin` in `src/app/admin/page.tsx`, but that is only a UX layer. The real security check is the API wrapper in `src/lib/middleware/with-role.ts`.

## Note-level permissions

- Resource permissions are centralized in `src/lib/auth/permissions.ts`.
- `getNoteAccessLevel()` turns the note owner id, note status, and collaborator rows into a single access object with `canEdit`, `canManageSharing`, and `canArchive`.
- `assertCanEditNote()`, `assertCanManageSharing()`, and `assertCanChangeStatus()` are called inside `src/services/note-service.ts` before any write occurs.
- Editors can modify note content through `updateNote()`, but only owners or app admins can call `upsertCollaborator()` and `updateStatus()`.

## Data isolation

- Member note scoping is centralized in `src/repositories/note-repository.ts` — `buildAccessibleNoteWhere()`.
- For `MEMBER` users, `buildAccessibleNoteWhere()` adds `collaborators: { some: { userId: sessionUserId } }` to every note query path.
- `listAccessibleForUser()`, `findAccessibleById()`, and `listAccessibleRevisions()` all call `buildAccessibleNoteWhere()`, so note lists, note detail, and revision history share the same access filter.
- `APP_ADMIN` is intentionally handled as an explicit exception inside `buildAccessibleNoteWhere()`, which keeps the bypass path reviewable in one function instead of scattered across routes.

## Validation boundary

- Input validation is explicit in `src/lib/validation/auth-schemas.ts` and `src/lib/validation/note-schemas.ts`.
- `src/lib/validation/parse-schema.ts` — `parseSchema()` converts Zod failures into `422 VALIDATION_ERROR` responses before service code runs.
- Conflict protection is part of the validation and service contract: `src/lib/validation/note-schemas.ts` — `updateNoteSchema` requires `baseVersionNumber`, and `src/services/note-service.ts` — `updateNote()` rejects stale versions with `409 VERSION_CONFLICT`.

## Multi-tenancy

Multi-tenancy is not included in this version because the product requirements are satisfied by per-note ownership and collaborator sharing rather than organization isolation.

To add multi-tenancy later without rewriting the whole app:

- Add `Tenant` and `Membership` models in `prisma/schema.prisma`.
- Add `tenantId` to `Note`, `AuditLog`, and any future tenant-owned models.
- Extend `src/lib/auth/session.ts` so the session carries the active tenant context.
- Update `src/repositories/note-repository.ts` — `buildAccessibleNoteWhere()` to scope by both `tenantId` and collaborator membership.
- Add tenant-aware guard helpers beside `getNoteAccessLevel()` in `src/lib/auth/permissions.ts`.
