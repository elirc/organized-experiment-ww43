/**
 * Implements note CRUD, conflict handling, sharing rules, and status changes.
 * Called by note API route handlers and nowhere else directly from the UI.
 * A junior engineer often lets each route own a slice of note behavior, which
 * scatters business rules and makes conflict handling inconsistent.
 */
import type { NoteStatus } from "@prisma/client";

import { auditLogRepository } from "@/repositories/audit-log-repository";
import { noteRepository } from "@/repositories/note-repository";
import { userRepository } from "@/repositories/user-repository";
import { prisma } from "@/lib/db/prisma";
import {
  assertCanChangeStatus,
  assertCanEditNote,
  assertCanManageSharing,
  getNoteAccessLevel,
} from "@/lib/auth/permissions";
import { appError } from "@/lib/http/app-error";
import type { AppSession } from "@/types/auth";
import type { NoteCollaboratorDto, NoteDetail, NoteRevisionDto, NoteSummary } from "@/types/note";

type NoteServiceDeps = {
  prisma: typeof prisma;
  noteRepository: typeof noteRepository;
  userRepository: typeof userRepository;
  auditLogRepository: typeof auditLogRepository;
};

const defaultDeps: NoteServiceDeps = {
  prisma,
  noteRepository,
  userRepository,
  auditLogRepository,
};

const toRevisionDto = (revision: Awaited<ReturnType<typeof noteRepository.listAccessibleRevisions>>[number]): NoteRevisionDto => ({
  id: revision.id,
  versionNumber: revision.versionNumber,
  titleSnapshot: revision.titleSnapshot,
  bodySnapshot: revision.bodySnapshot,
  changeSummary: revision.changeSummary,
  createdAt: revision.createdAt.toISOString(),
  editedBy: {
    id: revision.editedBy.id,
    name: revision.editedBy.name,
    email: revision.editedBy.email,
  },
});

const toCollaboratorDto = (
  collaborator: Awaited<ReturnType<typeof noteRepository.findAccessibleById>> extends infer T
    ? T extends { collaborators: infer U }
      ? U extends Array<infer V>
        ? V
        : never
      : never
    : never,
): NoteCollaboratorDto => ({
  id: collaborator.id,
  permission: collaborator.permission,
  user: {
    id: collaborator.user.id,
    name: collaborator.user.name,
    email: collaborator.user.email,
    role: collaborator.user.role,
  },
});

const toSummaryDto = (
  note: Awaited<ReturnType<typeof noteRepository.listAccessibleForUser>>[number],
): NoteSummary => ({
  id: note.id,
  title: note.title,
  excerpt: note.currentBody.slice(0, 140),
  currentVersionNumber: note.currentVersionNumber,
  status: note.status,
  updatedAt: note.updatedAt.toISOString(),
  lastEditedAt: note.lastEditedAt.toISOString(),
  owner: {
    id: note.owner.id,
    name: note.owner.name,
    email: note.owner.email,
  },
  currentUserPermission:
    note.collaborators[0]?.permission ?? (note.ownerId ? "OWNER" : "VIEWER"),
});

const toDetailDto = (
  note: NonNullable<Awaited<ReturnType<typeof noteRepository.findAccessibleById>>>,
  session: AppSession,
): NoteDetail => {
  const access = getNoteAccessLevel(session, {
    ownerId: note.ownerId,
    status: note.status,
    collaborators: note.collaborators.map((collaborator) => ({
      userId: collaborator.userId,
      permission: collaborator.permission,
    })),
  });

  return {
    id: note.id,
    title: note.title,
    currentBody: note.currentBody,
    currentVersionNumber: note.currentVersionNumber,
    status: note.status,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    lastEditedAt: note.lastEditedAt.toISOString(),
    owner: {
      id: note.owner.id,
      name: note.owner.name,
      email: note.owner.email,
    },
    access: {
      permission: access.permission,
      canEdit: access.canEdit,
      canManageSharing: access.canManageSharing,
      canArchive: access.canArchive,
    },
    collaborators: note.collaborators.map(toCollaboratorDto),
    revisions: note.revisions.map(toRevisionDto),
  };
};

const buildConflictDetails = (
  note: NonNullable<Awaited<ReturnType<typeof noteRepository.findAccessibleById>>>,
) => ({
  latestNote: {
    id: note.id,
    title: note.title,
    currentBody: note.currentBody,
    currentVersionNumber: note.currentVersionNumber,
    updatedAt: note.updatedAt.toISOString(),
    lastEditedAt: note.lastEditedAt.toISOString(),
    status: note.status,
  },
});

export const buildNoteService = (deps: NoteServiceDeps = defaultDeps) => ({
  async listNotes(session: AppSession): Promise<NoteSummary[]> {
    const notes = await deps.noteRepository.listAccessibleForUser(
      session.user.id,
      session.user.role,
    );

    return notes.map(toSummaryDto);
  },

  async createNote(
    session: AppSession,
    input: { title: string; body: string },
  ): Promise<NoteDetail> {
    const note = await deps.prisma.$transaction(async (db) => {
      const createdNote = await deps.noteRepository.createNote(
        {
          ownerId: session.user.id,
          title: input.title,
          body: input.body,
        },
        db,
      );

      await deps.auditLogRepository.create(
        {
          actorId: session.user.id,
          noteId: createdNote.id,
          action: "NOTE_CREATED",
        },
        db,
      );

      return createdNote;
    });

    return toDetailDto(note, session);
  },

  async getNoteDetail(session: AppSession, noteId: string): Promise<NoteDetail> {
    const note = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!note) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    return toDetailDto(note, session);
  },

  async listRevisions(session: AppSession, noteId: string): Promise<NoteRevisionDto[]> {
    const note = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!note) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    const revisions = await deps.noteRepository.listAccessibleRevisions(
      noteId,
      session.user.id,
      session.user.role,
    );

    return revisions.map(toRevisionDto);
  },

  async updateNote(
    session: AppSession,
    noteId: string,
    input: {
      title: string;
      body: string;
      baseVersionNumber: number;
      changeSummary?: string;
    },
  ): Promise<NoteDetail> {
    const currentNote = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!currentNote) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    const access = getNoteAccessLevel(session, {
      ownerId: currentNote.ownerId,
      status: currentNote.status,
      collaborators: currentNote.collaborators.map((collaborator) => ({
        userId: collaborator.userId,
        permission: collaborator.permission,
      })),
    });
    assertCanEditNote(access);

    if (currentNote.currentVersionNumber !== input.baseVersionNumber) {
      await deps.auditLogRepository.create({
        actorId: session.user.id,
        noteId,
        action: "NOTE_CONFLICT_REJECTED",
        metadata: {
          expectedVersionNumber: input.baseVersionNumber,
          actualVersionNumber: currentNote.currentVersionNumber,
        },
      });

      throw appError(
        "Someone else has updated this note. Reload the latest version before saving.",
        409,
        "VERSION_CONFLICT",
        buildConflictDetails(currentNote),
      );
    }

    const updated = await deps.prisma.$transaction(async (db) => {
      const updatedSuccessfully = await deps.noteRepository.updateNoteWithRevisionIfVersionMatches(
        {
          noteId,
          expectedVersionNumber: input.baseVersionNumber,
          title: input.title,
          body: input.body,
          editedById: session.user.id,
          changeSummary: input.changeSummary,
        },
        db,
      );

      if (!updatedSuccessfully) {
        return null;
      }

      await deps.auditLogRepository.create(
        {
          actorId: session.user.id,
          noteId,
          action: "NOTE_UPDATED",
          metadata: {
            versionNumber: input.baseVersionNumber + 1,
          },
        },
        db,
      );

      return deps.noteRepository.findAccessibleById(noteId, session.user.id, session.user.role);
    });

    if (!updated) {
      const latest = await deps.noteRepository.findAccessibleById(
        noteId,
        session.user.id,
        session.user.role,
      );

      if (!latest) {
        throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
      }

      throw appError(
        "Someone else has updated this note. Reload the latest version before saving.",
        409,
        "VERSION_CONFLICT",
        buildConflictDetails(latest),
      );
    }

    return toDetailDto(updated, session);
  },

  async upsertCollaborator(
    session: AppSession,
    noteId: string,
    input: { email: string; permission: "OWNER" | "EDITOR" | "VIEWER" },
  ): Promise<NoteDetail> {
    const note = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!note) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    const access = getNoteAccessLevel(session, {
      ownerId: note.ownerId,
      status: note.status,
      collaborators: note.collaborators.map((collaborator) => ({
        userId: collaborator.userId,
        permission: collaborator.permission,
      })),
    });
    assertCanManageSharing(access);

    const collaborator = await deps.userRepository.findByEmail(input.email);
    if (!collaborator) {
      throw appError("No user with that email exists yet.", 404, "USER_NOT_FOUND");
    }

    if (collaborator.id === note.ownerId && input.permission !== "OWNER") {
      throw appError("The note owner must keep OWNER permission.", 422, "INVALID_PERMISSION_CHANGE");
    }

    await deps.prisma.$transaction(async (db) => {
      await deps.noteRepository.upsertCollaborator(
        {
          noteId,
          userId: collaborator.id,
          permission: input.permission,
        },
        db,
      );

      await deps.auditLogRepository.create(
        {
          actorId: session.user.id,
          noteId,
          action: "NOTE_COLLABORATOR_UPSERTED",
          metadata: {
            collaboratorEmail: collaborator.email,
            permission: input.permission,
          },
        },
        db,
      );
    });

    const updatedNote = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!updatedNote) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    return toDetailDto(updatedNote, session);
  },

  async updateStatus(
    session: AppSession,
    noteId: string,
    nextStatus: NoteStatus,
  ): Promise<NoteDetail> {
    const note = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!note) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    const access = getNoteAccessLevel(session, {
      ownerId: note.ownerId,
      status: note.status,
      collaborators: note.collaborators.map((collaborator) => ({
        userId: collaborator.userId,
        permission: collaborator.permission,
      })),
    });
    assertCanChangeStatus(access);

    if (note.status === nextStatus) {
      throw appError(
        `This note is already ${nextStatus.toLowerCase()}.`,
        409,
        "INVALID_STATUS_TRANSITION",
      );
    }

    await deps.prisma.$transaction(async (db) => {
      await deps.noteRepository.updateStatus(noteId, nextStatus, db);
      await deps.auditLogRepository.create(
        {
          actorId: session.user.id,
          noteId,
          action: "NOTE_STATUS_CHANGED",
          metadata: {
            from: note.status,
            to: nextStatus,
          },
        },
        db,
      );
    });

    const updatedNote = await deps.noteRepository.findAccessibleById(
      noteId,
      session.user.id,
      session.user.role,
    );

    if (!updatedNote) {
      throw appError("This note was not found for your account.", 404, "NOTE_NOT_FOUND");
    }

    return toDetailDto(updatedNote, session);
  },
});

export const noteService = buildNoteService();

// ⚠️ SENIOR NOTE: Conflict handling lives here, not in the route, so every write
// path shares the same optimistic-concurrency rule and audit behavior.
