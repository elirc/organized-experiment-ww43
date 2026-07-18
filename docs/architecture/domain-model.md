# Domain Model

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o{ Note : owns
  User ||--o{ NoteCollaborator : joins
  User ||--o{ NoteRevision : edits
  User ||--o{ AuditLog : acts_in
  Note ||--o{ NoteCollaborator : shared_with
  Note ||--o{ NoteRevision : versioned_as
  Note ||--o{ AuditLog : referenced_by

  User {
    string id
    string email
    string name
    string passwordHash
    enum role
  }

  Session {
    string id
    string userId
    string tokenHash
    datetime expiresAt
  }

  Note {
    string id
    string ownerId
    string title
    string currentBody
    int currentVersionNumber
    enum status
  }

  NoteCollaborator {
    string id
    string noteId
    string userId
    enum permission
  }

  NoteRevision {
    string id
    string noteId
    int versionNumber
    string titleSnapshot
    string bodySnapshot
    string editedById
  }

  AuditLog {
    string id
    string actorId
    string noteId
    enum action
    json metadata
  }
```

## User
Model: `prisma/schema.prisma` — `model User`
Primary service: `src/services/auth-service.ts` — `login()`

## Session
Model: `prisma/schema.prisma` — `model Session`
Primary service: `src/services/auth-service.ts` — `login()` and `src/lib/auth/session.ts` — `resolveRequestSession()`

## Note
Model: `prisma/schema.prisma` — `model Note`
Primary service: `src/services/note-service.ts` — `createNote()`, `getNoteDetail()`, `updateNote()`, and `updateStatus()`

## NoteCollaborator
Model: `prisma/schema.prisma` — `model NoteCollaborator`
Primary service: `src/services/note-service.ts` — `upsertCollaborator()`

## NoteRevision
Model: `prisma/schema.prisma` — `model NoteRevision`
Primary service: `src/services/note-service.ts` — `updateNote()` and `listRevisions()`

## AuditLog
Model: `prisma/schema.prisma` — `model AuditLog`
Primary service: `src/services/auth-service.ts`, `src/services/note-service.ts`, and `src/services/audit-log-service.ts`
